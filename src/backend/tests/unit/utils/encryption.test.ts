import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import AWSMock from 'aws-sdk-mock';
import { encrypt, decrypt, hashPassword, verifyPassword } from '../../src/utils/encryption';
import { randomBytes } from 'crypto';

// Test data constants
const TEST_DATA_SIZES = [1024, 1024 * 1024, 10 * 1024 * 1024]; // 1KB, 1MB, 10MB
const TEST_PASSWORDS = ['Simple123!', 'Complex!@#$%^&*()', 'VeryLongPasswordForTesting123!@#'];
const MOCK_KMS_KEY_ID = 'arn:aws:kms:us-east-1:123456789012:key/mock-key-id';

describe('Encryption Module', () => {
  beforeEach(() => {
    // Mock AWS KMS service
    AWSMock.mock('KMS', 'generateDataKey', (params: any, callback: Function) => {
      callback(null, {
        Plaintext: Buffer.from('mock-data-key-'.padEnd(32, '0')),
        CiphertextBlob: Buffer.from('mock-encrypted-key')
      });
    });

    AWSMock.mock('KMS', 'decrypt', (params: any, callback: Function) => {
      callback(null, {
        Plaintext: Buffer.from('mock-data-key-'.padEnd(32, '0'))
      });
    });

    // Set environment variables
    process.env.AWS_KMS_KEY_ID = MOCK_KMS_KEY_ID;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    AWSMock.restore('KMS');
    jest.clearAllMocks();
  });

  describe('encrypt', () => {
    it('should successfully encrypt data of various sizes', async () => {
      for (const size of TEST_DATA_SIZES) {
        const testData = randomBytes(size);
        const result = await encrypt(testData);

        expect(result).toHaveProperty('encryptedData');
        expect(result).toHaveProperty('encryptedKey');
        expect(Buffer.isBuffer(result.encryptedData)).toBe(true);
        expect(Buffer.isBuffer(result.encryptedKey)).toBe(true);
      }
    });

    it('should generate unique IVs for each encryption', async () => {
      const testData = 'test-data';
      const results = await Promise.all([
        encrypt(testData),
        encrypt(testData),
        encrypt(testData)
      ]);

      // Extract IVs (first 12 bytes) from each encrypted result
      const ivs = results.map(r => r.encryptedData.subarray(0, 12));

      // Verify all IVs are unique
      const uniqueIvs = new Set(ivs.map(iv => iv.toString('hex')));
      expect(uniqueIvs.size).toBe(results.length);
    });

    it('should throw error for data exceeding maximum size', async () => {
      const oversizedData = randomBytes(11 * 1024 * 1024); // 11MB
      await expect(encrypt(oversizedData)).rejects.toThrow('Data exceeds maximum size');
    });

    it('should handle KMS service failures gracefully', async () => {
      AWSMock.remock('KMS', 'generateDataKey', (params: any, callback: Function) => {
        callback(new Error('KMS Service Error'));
      });

      await expect(encrypt('test-data')).rejects.toThrow('Encryption key generation failed');
    });
  });

  describe('decrypt', () => {
    it('should successfully decrypt encrypted data', async () => {
      const testData = 'sensitive-information';
      const encrypted = await encrypt(testData);
      const decrypted = await decrypt(encrypted.encryptedData, encrypted.encryptedKey);

      expect(decrypted.toString()).toBe(testData);
    });

    it('should verify authentication tag during decryption', async () => {
      const encrypted = await encrypt('test-data');
      // Corrupt the auth tag (bytes 12-28)
      encrypted.encryptedData[15] ^= 1;

      await expect(decrypt(encrypted.encryptedData, encrypted.encryptedKey))
        .rejects.toThrow('Data decryption failed');
    });

    it('should handle KMS key decryption failures', async () => {
      AWSMock.remock('KMS', 'decrypt', (params: any, callback: Function) => {
        callback(new Error('KMS Decryption Error'));
      });

      const encrypted = await encrypt('test-data');
      await expect(decrypt(encrypted.encryptedData, encrypted.encryptedKey))
        .rejects.toThrow('Data decryption failed');
    });
  });

  describe('password hashing', () => {
    it('should generate secure password hashes', async () => {
      for (const password of TEST_PASSWORDS) {
        const hash = await hashPassword(password);
        expect(typeof hash).toBe('string');
        expect(hash).toMatch(/^[A-Za-z0-9+/]+=*$/); // Base64 format
        expect(hash.length).toBeGreaterThan(64); // Minimum length for salt + hash
      }
    });

    it('should generate unique salts for identical passwords', async () => {
      const password = TEST_PASSWORDS[0];
      const hashes = await Promise.all([
        hashPassword(password),
        hashPassword(password),
        hashPassword(password)
      ]);

      // Verify all hashes are unique
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(hashes.length);
    });

    it('should verify passwords correctly', async () => {
      for (const password of TEST_PASSWORDS) {
        const hash = await hashPassword(password);
        
        // Test valid password
        const validResult = await verifyPassword(password, hash);
        expect(validResult).toBe(true);

        // Test invalid password
        const invalidResult = await verifyPassword(password + '!', hash);
        expect(invalidResult).toBe(false);
      }
    });

    it('should handle invalid hash formats gracefully', async () => {
      await expect(verifyPassword('password', 'invalid-hash'))
        .rejects.toThrow('Password verification failed');
    });

    it('should maintain constant-time comparison', async () => {
      const password = TEST_PASSWORDS[0];
      const hash = await hashPassword(password);

      const startTime = process.hrtime();
      await verifyPassword(password, hash);
      const validTime = process.hrtime(startTime);

      const startTime2 = process.hrtime();
      await verifyPassword('wrong-password', hash);
      const invalidTime = process.hrtime(startTime2);

      // Verify timing difference is minimal (within 2ms)
      const timeDiff = Math.abs(
        validTime[0] * 1e9 + validTime[1] - 
        (invalidTime[0] * 1e9 + invalidTime[1])
      ) / 1e6;
      expect(timeDiff).toBeLessThan(2);
    });
  });
});