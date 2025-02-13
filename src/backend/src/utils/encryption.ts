import { randomBytes, createCipheriv, createDecipheriv, pbkdf2 } from 'crypto'; // native
import { KMS, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms'; // v3.0.0
import { error, info } from './logger';
import { AWSClientManager } from '../config/aws';
import { promisify } from 'util';

// Constants for encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Length for GCM mode
const AUTH_TAG_LENGTH = 16;
const KMS_KEY_SPEC = 'AES_256';
const MAX_DATA_SIZE = 10 * 1024 * 1024; // 10MB max size
const PBKDF2_ITERATIONS = 310000; // OWASP recommended
const PBKDF2_KEYLEN = 32;
const SALT_LENGTH = 32;

// Promisify pbkdf2 for password hashing
const pbkdf2Async = promisify(pbkdf2);

/**
 * Generates a new data key using AWS KMS for envelope encryption
 * @returns Promise resolving to plaintext and encrypted key buffers
 */
async function generateDataKey(): Promise<{ plaintext: Buffer; encrypted: Buffer }> {
  try {
    const kmsClient = AWSClientManager.getKMSClient();
    const command = new GenerateDataKeyCommand({
      KeyId: process.env.AWS_KMS_KEY_ID,
      KeySpec: KMS_KEY_SPEC,
      EncryptionContext: {
        application: 'mga-os',
        environment: process.env.NODE_ENV || 'development'
      }
    });

    const response = await kmsClient.send(command);

    if (!response.Plaintext || !response.CiphertextBlob) {
      throw new Error('Failed to generate data key');
    }

    info('Generated new data key', { keyId: process.env.AWS_KMS_KEY_ID });

    return {
      plaintext: Buffer.from(response.Plaintext),
      encrypted: Buffer.from(response.CiphertextBlob)
    };
  } catch (err) {
    error('Error generating data key', err);
    throw new Error('Encryption key generation failed');
  }
}

/**
 * Encrypts data using AES-256-GCM with KMS-generated key
 * @param data Data to encrypt
 * @returns Promise resolving to encrypted data and key
 */
export async function encrypt(data: Buffer | string): Promise<{ encryptedData: Buffer; encryptedKey: Buffer }> {
  try {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    if (buffer.length > MAX_DATA_SIZE) {
      throw new Error(`Data exceeds maximum size of ${MAX_DATA_SIZE} bytes`);
    }

    // Generate new data key
    const { plaintext: dataKey, encrypted: encryptedKey } = await generateDataKey();

    // Generate random IV
    const iv = randomBytes(IV_LENGTH);

    // Create cipher and encrypt data
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, dataKey, iv);
    const encryptedContent = Buffer.concat([
      cipher.update(buffer),
      cipher.final()
    ]);

    // Get auth tag for integrity verification
    const authTag = cipher.getAuthTag();

    // Combine IV, auth tag, and encrypted content
    const encryptedData = Buffer.concat([
      iv,
      authTag,
      encryptedContent
    ]);

    info('Data encrypted successfully', { 
      size: buffer.length,
      algorithm: ENCRYPTION_ALGORITHM 
    });

    // Clear sensitive data from memory
    dataKey.fill(0);

    return { encryptedData, encryptedKey };
  } catch (err) {
    error('Encryption failed', err);
    throw new Error('Data encryption failed');
  }
}

/**
 * Decrypts data using the provided encrypted key and KMS
 * @param encryptedData Encrypted data buffer
 * @param encryptedKey Encrypted key buffer
 * @returns Promise resolving to decrypted data
 */
export async function decrypt(encryptedData: Buffer, encryptedKey: Buffer): Promise<Buffer> {
  try {
    // Decrypt the data key using KMS
    const kmsClient = AWSClientManager.getKMSClient();
    const command = new DecryptCommand({
      CiphertextBlob: encryptedKey,
      EncryptionContext: {
        application: 'mga-os',
        environment: process.env.NODE_ENV || 'development'
      }
    });

    const response = await kmsClient.send(command);
    
    if (!response.Plaintext) {
      throw new Error('Failed to decrypt data key');
    }

    const dataKey = Buffer.from(response.Plaintext);

    // Extract IV and auth tag from encrypted data
    const iv = encryptedData.subarray(0, IV_LENGTH);
    const authTag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encryptedContent = encryptedData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    // Create decipher and decrypt data
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, dataKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encryptedContent),
      decipher.final()
    ]);

    info('Data decrypted successfully', { size: decrypted.length });

    // Clear sensitive data from memory
    dataKey.fill(0);

    return decrypted;
  } catch (err) {
    error('Decryption failed', err);
    throw new Error('Data decryption failed');
  }
}

/**
 * Hashes passwords using PBKDF2 with secure parameters
 * @param password Password to hash
 * @returns Promise resolving to base64 encoded hash with salt
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const salt = randomBytes(SALT_LENGTH);
    const hash = await pbkdf2Async(
      password,
      salt,
      PBKDF2_ITERATIONS,
      PBKDF2_KEYLEN,
      'sha512'
    );

    // Combine salt and hash
    const combined = Buffer.concat([salt, hash]);
    
    info('Password hashed successfully');
    
    return combined.toString('base64');
  } catch (err) {
    error('Password hashing failed', err);
    throw new Error('Password hashing failed');
  }
}

/**
 * Verifies a password against its stored hash
 * @param password Password to verify
 * @param storedHash Stored hash to verify against
 * @returns Promise resolving to boolean indicating match
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const combined = Buffer.from(storedHash, 'base64');
    
    // Extract salt and hash
    const salt = combined.subarray(0, SALT_LENGTH);
    const hash = combined.subarray(SALT_LENGTH);

    // Hash the provided password
    const newHash = await pbkdf2Async(
      password,
      salt,
      PBKDF2_ITERATIONS,
      PBKDF2_KEYLEN,
      'sha512'
    );

    // Constant-time comparison
    return Buffer.compare(hash, newHash) === 0;
  } catch (err) {
    error('Password verification failed', err);
    throw new Error('Password verification failed');
  }
}