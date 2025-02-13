import { Redis, RedisCluster, Sentinel } from 'ioredis'; // v5.3.2
import { error, info, warn } from '../utils/logger';
import { recordDatabaseMetrics, recordCacheHitRate, recordLatency } from '../utils/metrics';

// Redis standalone configuration
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'mga:',
  maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
  enableReadyCheck: true,
  showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
  tls: process.env.REDIS_TLS_ENABLED === 'true',
  connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '5000'),
  maxReconnectAttempts: parseInt(process.env.REDIS_MAX_RECONNECT || '10'),
  defaultTTL: parseInt(process.env.REDIS_DEFAULT_TTL || '900'), // 15 minutes default TTL
  connectionPoolSize: parseInt(process.env.REDIS_POOL_SIZE || '10')
};

// Redis cluster configuration
const REDIS_CLUSTER_CONFIG = {
  nodes: process.env.REDIS_CLUSTER_NODES?.split(',') || [],
  redisOptions: {
    password: process.env.REDIS_PASSWORD,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'mga:',
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
    tls: process.env.REDIS_TLS_ENABLED === 'true',
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '5000'),
    maxReconnectAttempts: parseInt(process.env.REDIS_MAX_RECONNECT || '10'),
    defaultTTL: parseInt(process.env.REDIS_DEFAULT_TTL || '900'),
    connectionPoolSize: parseInt(process.env.REDIS_POOL_SIZE || '10')
  },
  clusterRetryStrategy: (times: number) => Math.min(times * 100, 3000)
};

/**
 * Creates and configures a Redis client instance with monitoring
 */
export const createRedisClient = (options: Partial<typeof REDIS_CONFIG> = {}): Redis => {
  const config = { ...REDIS_CONFIG, ...options };
  const client = new Redis(config);

  setupClientMonitoring(client);
  return client;
};

/**
 * Creates and configures a Redis Cluster client with failover support
 */
export const createRedisClusterClient = (options: Partial<typeof REDIS_CLUSTER_CONFIG> = {}): RedisCluster => {
  const config = { ...REDIS_CLUSTER_CONFIG, ...options };
  const client = new Redis.Cluster(config.nodes, {
    redisOptions: config.redisOptions,
    clusterRetryStrategy: config.clusterRetryStrategy
  });

  setupClientMonitoring(client);
  return client;
};

/**
 * Redis Manager class for handling client lifecycle and monitoring
 */
export class RedisManager {
  private client: Redis | RedisCluster;
  private readonly isClusterMode: boolean;
  private readonly connectionPool: Map<string, Redis | RedisCluster>;
  private healthMetrics: {
    hitRate: number;
    latency: number;
    memoryUsage: number;
    lastCheck: Date;
  };

  constructor(options: { clusterMode?: boolean } = {}) {
    this.isClusterMode = options.clusterMode || false;
    this.connectionPool = new Map();
    this.healthMetrics = {
      hitRate: 0,
      latency: 0,
      memoryUsage: 0,
      lastCheck: new Date()
    };
  }

  /**
   * Initializes Redis client with monitoring setup
   */
  public async initialize(): Promise<void> {
    try {
      this.client = this.isClusterMode
        ? createRedisClusterClient()
        : createRedisClient();

      await this.client.ping();
      info('Redis client initialized successfully');

      // Start health monitoring
      this.startHealthMonitoring();
    } catch (err) {
      error('Failed to initialize Redis client', err);
      throw err;
    }
  }

  /**
   * Returns a Redis client from the connection pool
   */
  public async getClient(): Promise<Redis | RedisCluster> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    const startTime = Date.now();
    try {
      await this.client.ping();
      recordLatency('redis_operation', Date.now() - startTime);
      return this.client;
    } catch (err) {
      error('Redis client health check failed', err);
      await this.handleFailover();
      throw err;
    }
  }

  /**
   * Monitors Redis instance health
   */
  private async monitorHealth(): Promise<void> {
    try {
      const info = await this.client.info();
      const memory = await this.client.info('memory');
      const stats = await this.client.info('stats');

      // Parse and record metrics
      const hitRate = this.calculateHitRate(stats);
      const memoryUsage = this.parseMemoryUsage(memory);
      const latency = await this.measureLatency();

      this.healthMetrics = {
        hitRate,
        latency,
        memoryUsage,
        lastCheck: new Date()
      };

      // Record metrics
      recordCacheHitRate(hitRate);
      recordDatabaseMetrics({
        operation: 'health_check',
        queryTime: latency,
        poolSize: this.connectionPool.size,
        poolUsed: this.getActiveConnections(),
        cacheHit: hitRate > 0.85
      });

      // Alert on concerning metrics
      if (hitRate < 0.85) {
        warn('Cache hit rate below threshold', { hitRate });
      }
      if (latency > 100) {
        warn('Redis latency above threshold', { latency });
      }
    } catch (err) {
      error('Failed to monitor Redis health', err);
    }
  }

  private startHealthMonitoring(): void {
    setInterval(() => this.monitorHealth(), 60000); // Check every minute
  }

  private async handleFailover(): Promise<void> {
    if (this.isClusterMode) {
      await this.handleClusterFailover();
    } else {
      await this.handleStandaloneFailover();
    }
  }

  private async handleClusterFailover(): Promise<void> {
    try {
      const client = createRedisClusterClient();
      await client.ping();
      this.client = client;
      info('Successfully failed over to new cluster nodes');
    } catch (err) {
      error('Cluster failover failed', err);
      throw err;
    }
  }

  private async handleStandaloneFailover(): Promise<void> {
    try {
      const client = createRedisClient();
      await client.ping();
      this.client = client;
      info('Successfully failed over to new Redis instance');
    } catch (err) {
      error('Standalone failover failed', err);
      throw err;
    }
  }

  private calculateHitRate(stats: string): number {
    const hits = parseInt(stats.match(/keyspace_hits:(\d+)/)?.[1] || '0');
    const misses = parseInt(stats.match(/keyspace_misses:(\d+)/)?.[1] || '0');
    return hits / (hits + misses) || 0;
  }

  private parseMemoryUsage(memory: string): number {
    return parseInt(memory.match(/used_memory:(\d+)/)?.[1] || '0');
  }

  private async measureLatency(): Promise<number> {
    const start = Date.now();
    await this.client.ping();
    return Date.now() - start;
  }

  private getActiveConnections(): number {
    return this.connectionPool.size;
  }
}

function setupClientMonitoring(client: Redis | RedisCluster): void {
  client.on('connect', () => info('Redis client connected'));
  client.on('ready', () => info('Redis client ready'));
  client.on('error', (err) => error('Redis client error', err));
  client.on('close', () => warn('Redis client connection closed'));
  client.on('reconnecting', () => info('Redis client reconnecting'));
  client.on('end', () => warn('Redis client connection ended'));
}