import winston from 'winston'; // v3.10.0
import DailyRotateFile from 'winston-daily-rotate-file'; // v4.7.1
import { ElasticsearchTransport } from 'winston-elasticsearch'; // v0.17.4
import WinstonCloudWatch from 'winston-cloudwatch'; // v3.1.1
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs'; // v3.400.0

// Define standard log levels with numeric priorities
export const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define color scheme for console output
const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

/**
 * Creates a standardized log format with correlation tracking and metadata
 */
const createLogFormat = (): winston.Format => {
  return winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.metadata(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, correlationId, metadata, stack }) => {
      const logEntry = {
        timestamp,
        level,
        message,
        ...(correlationId && { correlationId }),
        ...(metadata && { metadata }),
        ...(stack && { stack })
      };
      return JSON.stringify(logEntry);
    })
  );
};

/**
 * Creates a rotating file transport with compression and retention policies
 */
const createFileTransport = (): DailyRotateFile => {
  return new DailyRotateFile({
    filename: 'logs/mga-os-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    format: createLogFormat()
  });
};

/**
 * Manages Winston logger configuration with environment-specific settings
 * and integration with various logging backends
 */
export class LoggerConfig {
  private logger: winston.Logger;
  private correlationId: string;

  constructor() {
    this.correlationId = '';
    this.logger = this.createLogger();
  }

  /**
   * Creates and configures a Winston logger instance with appropriate transports
   */
  public createLogger(): winston.Logger {
    const transports: winston.transport[] = [
      // Console transport with color coding
      new winston.transports.Console({
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        format: winston.format.combine(
          winston.format.colorize({ colors: LOG_COLORS }),
          winston.format.simple()
        )
      }),
      // Rotating file transport
      createFileTransport()
    ];

    // Add Elasticsearch transport in non-local environments
    if (process.env.NODE_ENV !== 'local') {
      transports.push(
        new ElasticsearchTransport({
          level: 'info',
          clientOpts: {
            node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
            auth: {
              username: process.env.ELASTICSEARCH_USERNAME || '',
              password: process.env.ELASTICSEARCH_PASSWORD || ''
            }
          },
          indexPrefix: 'mga-os-logs',
          indexSuffixPattern: 'YYYY.MM.DD'
        })
      );
    }

    // Add CloudWatch transport in production
    if (process.env.NODE_ENV === 'production') {
      transports.push(this.createCloudWatchTransport());
    }

    return winston.createLogger({
      levels: LOG_LEVELS,
      format: createLogFormat(),
      transports,
      exitOnError: false
    });
  }

  /**
   * Sets correlation ID for request tracking
   */
  public setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
    this.logger.defaultMeta = {
      ...this.logger.defaultMeta,
      correlationId
    };
  }

  /**
   * Creates CloudWatch transport using AWS credentials from environment
   */
  private createCloudWatchTransport(): WinstonCloudWatch {
    const cloudWatchClient = new CloudWatchLogsClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });

    return new WinstonCloudWatch({
      cloudWatchLogs: cloudWatchClient,
      logGroupName: process.env.CLOUDWATCH_LOG_GROUP || '/mga-os/application',
      logStreamName: `${process.env.NODE_ENV}-${new Date().toISOString().split('T')[0]}`,
      awsOptions: {
        region: process.env.AWS_REGION || 'us-east-1'
      },
      retentionInDays: 14,
      jsonMessage: true,
      messageFormatter: ({ level, message, metadata }) => JSON.stringify({
        level,
        message,
        ...metadata
      })
    });
  }

  /**
   * Returns the configured logger instance
   */
  public getLogger(): winston.Logger {
    return this.logger;
  }
}