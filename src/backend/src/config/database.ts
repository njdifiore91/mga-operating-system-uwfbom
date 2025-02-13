import { Sequelize, Options } from 'sequelize'; // v6.32.1
import { Pool } from 'pg'; // v8.11.1
import 'pg-hstore'; // v2.3.4
import { error, info } from '../utils/logger';

// Global constants for database configuration
const DEFAULT_CONNECTION_TIMEOUT = 30000;
const MAX_POOL_SIZE = 20;
const MIN_POOL_SIZE = 5;
const IDLE_TIMEOUT = 10000;
const RETRY_ATTEMPTS = 3;
const STATEMENT_TIMEOUT = 30000;

// Singleton instance
let sequelizeInstance: Sequelize | null = null;

// Database configuration object
export const databaseConfig: Options = {
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mga_os',
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // Connection pool configuration
  pool: {
    max: MAX_POOL_SIZE,
    min: MIN_POOL_SIZE,
    idle: IDLE_TIMEOUT,
    acquire: DEFAULT_CONNECTION_TIMEOUT,
    evict: 1000
  },

  // SSL configuration for secure connections
  ssl: process.env.NODE_ENV === 'production' ? {
    require: true,
    rejectUnauthorized: false,
    ca: process.env.DB_SSL_CA,
    cert: process.env.DB_SSL_CERT,
    key: process.env.DB_SSL_KEY
  } : false,

  // Read replica configuration
  replication: {
    read: [
      { host: process.env.DB_READ_HOST_1 || 'localhost', username: process.env.DB_READ_USER_1 },
      { host: process.env.DB_READ_HOST_2 || 'localhost', username: process.env.DB_READ_USER_2 }
    ],
    write: { host: process.env.DB_HOST || 'localhost', username: process.env.DB_USER }
  },

  // Dialect-specific options
  dialectOptions: {
    statement_timeout: STATEMENT_TIMEOUT,
    idle_in_transaction_session_timeout: IDLE_TIMEOUT,
    ssl: process.env.NODE_ENV === 'production',
    pool: {
      max: MAX_POOL_SIZE,
      min: MIN_POOL_SIZE,
      idleTimeoutMillis: IDLE_TIMEOUT,
      connectionTimeoutMillis: DEFAULT_CONNECTION_TIMEOUT
    }
  },

  // Additional options
  timezone: 'UTC',
  logging: (msg: string) => info('Sequelize Query:', { query: msg }),
  benchmark: true,
  define: {
    timestamps: true,
    underscored: true,
    paranoid: true,
    freezeTableName: true
  }
};

/**
 * Initializes database connection with Sequelize ORM including high availability
 * and performance configurations
 */
export const initializeDatabase = async (): Promise<Sequelize> => {
  try {
    const sequelize = new Sequelize({
      ...databaseConfig,
      hooks: {
        beforeConnect: async (config: any) => {
          info('Attempting database connection', { host: config.host });
        },
        afterConnect: async (connection: any) => {
          info('Database connection established', { 
            host: connection.client.host,
            database: connection.client.database
          });
        }
      }
    });

    // Test the connection
    await sequelize.authenticate();
    
    // Test read replica connections
    if (databaseConfig.replication) {
      for (const replica of databaseConfig.replication.read) {
        const testConn = new Pool({
          host: replica.host,
          user: replica.username,
          password: process.env.DB_READ_PASSWORD,
          database: databaseConfig.database,
          port: databaseConfig.port
        });
        await testConn.query('SELECT 1');
        await testConn.end();
      }
    }

    sequelizeInstance = sequelize;
    info('Database initialization complete');
    return sequelize;

  } catch (err) {
    error('Failed to initialize database', err);
    throw err;
  }
};

/**
 * Returns singleton instance of Sequelize with lazy initialization
 */
export const getSequelize = async (): Promise<Sequelize> => {
  if (!sequelizeInstance) {
    return initializeDatabase();
  }

  try {
    await sequelizeInstance.authenticate();
    return sequelizeInstance;
  } catch (err) {
    error('Database connection lost, attempting reconnection', err);
    return initializeDatabase();
  }
};

/**
 * Gracefully closes database connections with proper cleanup
 */
export const closeDatabase = async (): Promise<void> => {
  if (!sequelizeInstance) {
    return;
  }

  try {
    // Wait for pending transactions
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Close read replica connections
    if (databaseConfig.replication) {
      for (const replica of databaseConfig.replication.read) {
        const pool = new Pool({
          host: replica.host,
          user: replica.username,
          password: process.env.DB_READ_PASSWORD,
          database: databaseConfig.database
        });
        await pool.end();
      }
    }

    await sequelizeInstance.close();
    sequelizeInstance = null;
    info('Database connections closed successfully');
  } catch (err) {
    error('Error closing database connections', err);
    throw err;
  }
};

/**
 * Performs health check on database connections
 */
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const sequelize = await getSequelize();
    
    // Check primary connection
    await sequelize.authenticate();
    
    // Check read replicas if configured
    if (databaseConfig.replication) {
      for (const replica of databaseConfig.replication.read) {
        const pool = new Pool({
          host: replica.host,
          user: replica.username,
          password: process.env.DB_READ_PASSWORD,
          database: databaseConfig.database
        });
        await pool.query('SELECT 1');
        await pool.end();
      }
    }

    // Check connection pool metrics
    const pool = sequelize.connectionManager as any;
    const poolSize = pool.pool.size;
    const availableConnections = pool.pool.available;
    
    info('Database health check passed', {
      poolSize,
      availableConnections,
      replicasHealthy: true
    });

    return true;
  } catch (err) {
    error('Database health check failed', err);
    return false;
  }
};