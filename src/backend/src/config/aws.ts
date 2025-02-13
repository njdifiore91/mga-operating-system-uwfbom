import { 
  S3Client, 
  S3ClientConfig 
} from '@aws-sdk/client-s3'; // v3.400.0
import { 
  CloudWatchClient, 
  CloudWatchClientConfig 
} from '@aws-sdk/client-cloudwatch'; // v3.400.0
import { 
  KMSClient, 
  KMSClientConfig 
} from '@aws-sdk/client-kms'; // v3.400.0
import { 
  SecretsManagerClient, 
  SecretsManagerClientConfig 
} from '@aws-sdk/client-secrets-manager'; // v3.400.0
import { 
  defaultRetryStrategy, 
  RetryStrategy 
} from '@aws-sdk/middleware-retry'; // v3.400.0
import { Logger } from '../utils/logger';

// AWS Configuration Constants
const AWS_CONFIG = {
  region: process.env.AWS_REGION || 'us-east-1',
  maxRetries: 3,
  timeout: 5000,
  connectionTimeout: 3000,
  keepAlive: true,
  maxConnections: 50
};

// Encryption Configuration
const AWS_ENCRYPTION_CONFIG = {
  kmsKeyId: process.env.AWS_KMS_KEY_ID,
  algorithm: 'AES-256-GCM',
  keyRotationInterval: 90, // days
  encryptionContext: {
    application: 'mga-os',
    environment: process.env.NODE_ENV
  }
};

// Enhanced retry strategy with exponential backoff
const createRetryStrategy = (): RetryStrategy => {
  return {
    ...defaultRetryStrategy,
    maxRetries: AWS_CONFIG.maxRetries,
    retryDelay: (attempt: number) => {
      return Math.min(Math.pow(2, attempt) * 100, 5000);
    }
  };
};

/**
 * Creates an enhanced S3 client with encryption and monitoring
 */
const createS3Client = (): S3Client => {
  const config: S3ClientConfig = {
    region: AWS_CONFIG.region,
    maxAttempts: AWS_CONFIG.maxRetries,
    requestTimeout: AWS_CONFIG.timeout,
    retryStrategy: createRetryStrategy(),
    endpoint: process.env.AWS_S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
    }
  };

  return new S3Client(config);
};

/**
 * Creates an enhanced CloudWatch client with monitoring capabilities
 */
const createCloudWatchClient = (): CloudWatchClient => {
  const config: CloudWatchClientConfig = {
    region: AWS_CONFIG.region,
    maxAttempts: AWS_CONFIG.maxRetries,
    requestTimeout: AWS_CONFIG.timeout,
    retryStrategy: createRetryStrategy(),
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
    }
  };

  return new CloudWatchClient(config);
};

/**
 * Creates an enhanced KMS client with security features
 */
const createKMSClient = (): KMSClient => {
  const config: KMSClientConfig = {
    region: AWS_CONFIG.region,
    maxAttempts: AWS_CONFIG.maxRetries,
    requestTimeout: AWS_CONFIG.timeout,
    retryStrategy: createRetryStrategy(),
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
    }
  };

  return new KMSClient(config);
};

/**
 * AWS Service Manager with enhanced security and monitoring features
 */
export class AWSManager {
  private static instance: AWSManager;
  private s3Client: S3Client;
  private cloudWatchClient: CloudWatchClient;
  private kmsClient: KMSClient;
  private secretsClient: SecretsManagerClient;
  private initialized: boolean = false;

  private constructor() {
    this.s3Client = createS3Client();
    this.cloudWatchClient = createCloudWatchClient();
    this.kmsClient = createKMSClient();
    this.secretsClient = new SecretsManagerClient({
      region: AWS_CONFIG.region,
      maxAttempts: AWS_CONFIG.maxRetries,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    });
  }

  /**
   * Returns singleton instance of AWSManager
   */
  public static getInstance(): AWSManager {
    if (!AWSManager.instance) {
      AWSManager.instance = new AWSManager();
    }
    return AWSManager.instance;
  }

  /**
   * Initializes AWS services with enhanced features
   */
  public async initialize(): Promise<void> {
    try {
      if (this.initialized) {
        return;
      }

      // Validate AWS credentials
      await this.validateCredentials();

      // Configure encryption settings
      await this.configureEncryption();

      // Initialize monitoring
      await this.initializeMonitoring();

      this.initialized = true;
      Logger.info('AWS services initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize AWS services', error);
      throw error;
    }
  }

  /**
   * Validates AWS credentials and permissions
   */
  public async validateCredentials(): Promise<boolean> {
    try {
      // Test S3 access
      await this.s3Client.send({ 
        $command: 'ListBucketsCommand' 
      });

      // Test KMS access
      await this.kmsClient.send({
        $command: 'ListKeysCommand'
      });

      // Test CloudWatch access
      await this.cloudWatchClient.send({
        $command: 'ListMetricsCommand'
      });

      Logger.info('AWS credentials validated successfully');
      return true;
    } catch (error) {
      Logger.error('AWS credentials validation failed', error);
      throw error;
    }
  }

  /**
   * Configures encryption settings using KMS
   */
  private async configureEncryption(): Promise<void> {
    try {
      // Verify KMS key
      await this.kmsClient.send({
        $command: 'DescribeKeyCommand',
        KeyId: AWS_ENCRYPTION_CONFIG.kmsKeyId
      });

      // Schedule key rotation
      await this.kmsClient.send({
        $command: 'EnableKeyRotationCommand',
        KeyId: AWS_ENCRYPTION_CONFIG.kmsKeyId
      });

      Logger.info('AWS encryption configured successfully');
    } catch (error) {
      Logger.error('Failed to configure AWS encryption', error);
      throw error;
    }
  }

  /**
   * Initializes CloudWatch monitoring
   */
  private async initializeMonitoring(): Promise<void> {
    try {
      await this.cloudWatchClient.send({
        $command: 'PutMetricDataCommand',
        Namespace: 'MGA-OS/AWS',
        MetricData: [{
          MetricName: 'ServiceInitialization',
          Value: 1,
          Unit: 'Count',
          Dimensions: [{
            Name: 'Environment',
            Value: process.env.NODE_ENV || 'development'
          }]
        }]
      });

      Logger.info('AWS monitoring initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize AWS monitoring', error);
      throw error;
    }
  }

  // Service client getters
  public getS3Client(): S3Client {
    return this.s3Client;
  }

  public getCloudWatchClient(): CloudWatchClient {
    return this.cloudWatchClient;
  }

  public getKMSClient(): KMSClient {
    return this.kmsClient;
  }

  public getSecretsClient(): SecretsManagerClient {
    return this.secretsClient;
  }
}

// Export singleton instance
export const awsManager = AWSManager.getInstance();