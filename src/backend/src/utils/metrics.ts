import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client'; // v14.2.0
import express from 'express'; // v4.18.2
import { error, info } from './logger';

// Initialize Prometheus registry with default configuration
const metricsRegistry = new Registry();
const defaultLabels = { app: 'mga-os', env: process.env.NODE_ENV };
const METRIC_PREFIX = 'mga_os_';
const SLO_TARGETS = {
  responseTime: 2000, // 2 seconds
  availability: 0.999, // 99.9%
  successRate: 0.995 // 99.5%
};

// Metric types definition
type MetricType = 'counter' | 'histogram' | 'gauge';
type MetricConfig = {
  labelNames?: string[];
  buckets?: number[];
  alertThresholds?: {
    warning?: number;
    critical?: number;
  };
};

interface APIMetricData {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  clientId?: string;
}

interface DBMetricData {
  operation: string;
  queryTime: number;
  poolSize: number;
  poolUsed: number;
  cacheHit?: boolean;
  transactionId?: string;
}

interface CacheMetricData {
  operation: string;
  hitRate: number;
  memoryUsage: number;
  evictionCount: number;
  latency: number;
}

export class MetricsManager {
  private registry: Registry;
  private metrics: Map<string, any>;
  private readonly defaultBuckets: number[];

  constructor() {
    this.registry = metricsRegistry;
    this.metrics = new Map();
    this.defaultBuckets = [0.1, 0.5, 1, 2, 5, 10, 20, 30, 60];
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Set default labels for all metrics
      this.registry.setDefaultLabels(defaultLabels);

      // Initialize system metrics collectors
      collectDefaultMetrics({ register: this.registry, prefix: METRIC_PREFIX });

      // Initialize core application metrics
      this.initializeAPIMetrics();
      this.initializeDatabaseMetrics();
      this.initializeCacheMetrics();
      this.initializeSLOMetrics();

      info('Metrics system initialized successfully');
    } catch (err) {
      error('Failed to initialize metrics system', err);
      throw err;
    }
  }

  private initializeAPIMetrics(): void {
    // Request count metrics
    this.createMetric('http_requests_total', 'Total HTTP requests', 'counter', {
      labelNames: ['method', 'path', 'status']
    });

    // Response time metrics
    this.createMetric('http_request_duration_seconds', 'HTTP request duration', 'histogram', {
      labelNames: ['method', 'path'],
      buckets: this.defaultBuckets
    });

    // Request/Response size metrics
    this.createMetric('http_request_size_bytes', 'HTTP request size', 'histogram', {
      labelNames: ['method', 'path']
    });
    this.createMetric('http_response_size_bytes', 'HTTP response size', 'histogram', {
      labelNames: ['method', 'path']
    });
  }

  private initializeDatabaseMetrics(): void {
    // Query performance metrics
    this.createMetric('db_query_duration_seconds', 'Database query duration', 'histogram', {
      labelNames: ['operation'],
      buckets: this.defaultBuckets
    });

    // Connection pool metrics
    this.createMetric('db_connections_total', 'Database connections', 'gauge', {
      labelNames: ['state']
    });

    // Cache effectiveness metrics
    this.createMetric('db_cache_hit_ratio', 'Database cache hit ratio', 'gauge');
  }

  private initializeCacheMetrics(): void {
    // Cache performance metrics
    this.createMetric('cache_hit_ratio', 'Cache hit ratio', 'gauge');
    this.createMetric('cache_memory_usage_bytes', 'Cache memory usage', 'gauge');
    this.createMetric('cache_evictions_total', 'Cache eviction count', 'counter');
    this.createMetric('cache_operation_duration_seconds', 'Cache operation duration', 'histogram', {
      labelNames: ['operation'],
      buckets: this.defaultBuckets
    });
  }

  private initializeSLOMetrics(): void {
    // SLO tracking metrics
    this.createMetric('slo_availability_ratio', 'Service availability ratio', 'gauge');
    this.createMetric('slo_success_ratio', 'Request success ratio', 'gauge');
    this.createMetric('slo_latency_ratio', 'Request latency ratio', 'gauge');
  }

  private createMetric(name: string, help: string, type: MetricType, config: MetricConfig = {}): any {
    const fullName = `${METRIC_PREFIX}${name}`;
    let metric;

    switch (type) {
      case 'counter':
        metric = new Counter({
          name: fullName,
          help,
          labelNames: config.labelNames,
          registers: [this.registry]
        });
        break;

      case 'histogram':
        metric = new Histogram({
          name: fullName,
          help,
          labelNames: config.labelNames,
          buckets: config.buckets || this.defaultBuckets,
          registers: [this.registry]
        });
        break;

      case 'gauge':
        metric = new Gauge({
          name: fullName,
          help,
          labelNames: config.labelNames,
          registers: [this.registry]
        });
        break;

      default:
        throw new Error(`Unsupported metric type: ${type}`);
    }

    this.metrics.set(fullName, metric);
    return metric;
  }

  public recordAPIMetrics(data: APIMetricData): void {
    try {
      // Record request count
      this.metrics.get(`${METRIC_PREFIX}http_requests_total`)
        .labels(data.method, data.path, data.statusCode.toString())
        .inc();

      // Record response time
      this.metrics.get(`${METRIC_PREFIX}http_request_duration_seconds`)
        .labels(data.method, data.path)
        .observe(data.responseTime / 1000);

      // Record request/response sizes
      this.metrics.get(`${METRIC_PREFIX}http_request_size_bytes`)
        .labels(data.method, data.path)
        .observe(data.requestSize);

      this.metrics.get(`${METRIC_PREFIX}http_response_size_bytes`)
        .labels(data.method, data.path)
        .observe(data.responseSize);

      // Update SLO metrics
      this.updateSLOMetrics(data);
    } catch (err) {
      error('Failed to record API metrics', err);
    }
  }

  public recordDatabaseMetrics(data: DBMetricData): void {
    try {
      // Record query duration
      this.metrics.get(`${METRIC_PREFIX}db_query_duration_seconds`)
        .labels(data.operation)
        .observe(data.queryTime / 1000);

      // Update connection pool metrics
      this.metrics.get(`${METRIC_PREFIX}db_connections_total`)
        .labels('total')
        .set(data.poolSize);
      this.metrics.get(`${METRIC_PREFIX}db_connections_total`)
        .labels('used')
        .set(data.poolUsed);

      // Update cache hit ratio if applicable
      if (typeof data.cacheHit !== 'undefined') {
        this.metrics.get(`${METRIC_PREFIX}db_cache_hit_ratio`)
          .set(data.cacheHit ? 1 : 0);
      }
    } catch (err) {
      error('Failed to record database metrics', err);
    }
  }

  public recordCacheMetrics(data: CacheMetricData): void {
    try {
      // Record cache performance metrics
      this.metrics.get(`${METRIC_PREFIX}cache_hit_ratio`)
        .set(data.hitRate);
      this.metrics.get(`${METRIC_PREFIX}cache_memory_usage_bytes`)
        .set(data.memoryUsage);
      this.metrics.get(`${METRIC_PREFIX}cache_evictions_total`)
        .inc(data.evictionCount);
      this.metrics.get(`${METRIC_PREFIX}cache_operation_duration_seconds`)
        .labels(data.operation)
        .observe(data.latency / 1000);
    } catch (err) {
      error('Failed to record cache metrics', err);
    }
  }

  private updateSLOMetrics(data: APIMetricData): void {
    // Update availability ratio
    const isAvailable = data.statusCode !== 503;
    this.metrics.get(`${METRIC_PREFIX}slo_availability_ratio`)
      .set(isAvailable ? 1 : 0);

    // Update success ratio
    const isSuccess = data.statusCode < 500;
    this.metrics.get(`${METRIC_PREFIX}slo_success_ratio`)
      .set(isSuccess ? 1 : 0);

    // Update latency ratio
    const meetsLatencyTarget = data.responseTime <= SLO_TARGETS.responseTime;
    this.metrics.get(`${METRIC_PREFIX}slo_latency_ratio`)
      .set(meetsLatencyTarget ? 1 : 0);
  }

  public getMetricsMiddleware(): express.RequestHandler {
    return async (req: express.Request, res: express.Response) => {
      try {
        const metrics = await this.registry.metrics();
        res.set('Content-Type', this.registry.contentType);
        res.send(metrics);
      } catch (err) {
        error('Failed to generate metrics', err);
        res.status(500).send('Failed to generate metrics');
      }
    };
  }
}

// Export singleton instance
export const metricsManager = new MetricsManager();