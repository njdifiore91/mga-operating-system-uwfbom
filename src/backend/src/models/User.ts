import { Model, DataTypes } from 'sequelize';
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt'; // v5.1.0
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms'; // v3.0.0
import { error, info } from '../utils/logger';

// KMS client initialization
const kmsClient = new KMSClient({ region: process.env.AWS_REGION || 'us-east-1' });

// User role enumeration
export enum UserRole {
  MGA_ADMIN = 'MGA_ADMIN',
  UNDERWRITER = 'UNDERWRITER',
  CLAIMS_HANDLER = 'CLAIMS_HANDLER',
  AUDITOR = 'AUDITOR'
}

// User status enumeration
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  LOCKED = 'LOCKED',
  PENDING_MFA = 'PENDING_MFA',
  PASSWORD_EXPIRED = 'PASSWORD_EXPIRED'
}

// Security constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;
const PASSWORD_EXPIRY_DAYS = 90;
const PBKDF2_ITERATIONS = 310000;
const SALT_BYTES = 32;
const KEY_LENGTH = 64;

// Role-based permissions mapping
const ROLE_PERMISSIONS = {
  [UserRole.MGA_ADMIN]: ['*'],
  [UserRole.UNDERWRITER]: [
    'policy:read',
    'policy:write',
    'risk:assess',
    'documents:read',
    'documents:write'
  ],
  [UserRole.CLAIMS_HANDLER]: [
    'claims:read',
    'claims:write',
    'documents:read'
  ],
  [UserRole.AUDITOR]: [
    'policy:read',
    'claims:read',
    'documents:read',
    'audit:read'
  ]
};

export class User extends Model {
  public id!: string;
  public email!: string;
  public passwordHash!: string;
  public firstName!: string;
  public lastName!: string;
  public role!: UserRole;
  public status!: UserStatus;
  public mfaEnabled!: boolean;
  public mfaSecret!: string | null;
  public lastLoginAt!: Date | null;
  public passwordChangedAt!: Date | null;
  public failedLoginAttempts!: number;
  public lockoutUntil!: Date | null;
  public lastIpAddress!: string | null;
  public securityAuditLog!: object[];
  public permissions!: string[];

  // Model initialization
  public static initialize(sequelize: any): void {
    super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true
        }
      },
      passwordHash: {
        type: DataTypes.STRING(1024),
        allowNull: false
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      role: {
        type: DataTypes.ENUM(...Object.values(UserRole)),
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM(...Object.values(UserStatus)),
        allowNull: false,
        defaultValue: UserStatus.PENDING_MFA
      },
      mfaEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      mfaSecret: {
        type: DataTypes.STRING(1024),
        allowNull: true
      },
      lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      passwordChangedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      failedLoginAttempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      lockoutUntil: {
        type: DataTypes.DATE,
        allowNull: true
      },
      lastIpAddress: {
        type: DataTypes.STRING,
        allowNull: true
      },
      securityAuditLog: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: []
      },
      permissions: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: []
      }
    }, {
      sequelize,
      tableName: 'users',
      timestamps: true,
      paranoid: true,
      indexes: [
        { unique: true, fields: ['email'] },
        { fields: ['status'] },
        { fields: ['role'] }
      ]
    });
  }

  /**
   * Securely sets user password with enhanced encryption
   */
  public async setPassword(password: string): Promise<void> {
    try {
      // Validate password complexity
      if (!this.validatePasswordComplexity(password)) {
        throw new Error('Password does not meet security requirements');
      }

      // Generate salt and hash password
      const salt = crypto.randomBytes(SALT_BYTES);
      const hash = await new Promise<Buffer>((resolve, reject) => {
        crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512', (err, derivedKey) => {
          if (err) reject(err);
          resolve(derivedKey);
        });
      });

      // Encrypt hash using KMS
      const encryptCommand = new EncryptCommand({
        KeyId: process.env.KMS_KEY_ID,
        Plaintext: Buffer.concat([salt, hash])
      });
      const { CiphertextBlob } = await kmsClient.send(encryptCommand);

      // Update user properties
      this.passwordHash = CiphertextBlob!.toString('base64');
      this.passwordChangedAt = new Date();
      this.failedLoginAttempts = 0;
      this.lockoutUntil = null;

      // Log password change
      this.logSecurityEvent('password_changed');
      await this.save();

    } catch (err) {
      error('Error setting password', err);
      throw new Error('Failed to set password');
    }
  }

  /**
   * Verifies password with rate limiting and account lockout
   */
  public async verifyPassword(password: string, ipAddress: string): Promise<boolean> {
    try {
      // Check account lockout
      if (this.isLocked()) {
        throw new Error('Account is locked');
      }

      // Decrypt password hash using KMS
      const decryptCommand = new DecryptCommand({
        CiphertextBlob: Buffer.from(this.passwordHash, 'base64')
      });
      const { Plaintext } = await kmsClient.send(decryptCommand);
      
      // Split salt and hash
      const combined = Buffer.from(Plaintext!);
      const salt = combined.slice(0, SALT_BYTES);
      const storedHash = combined.slice(SALT_BYTES);

      // Verify password
      const hash = await new Promise<Buffer>((resolve, reject) => {
        crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512', (err, derivedKey) => {
          if (err) reject(err);
          resolve(derivedKey);
        });
      });

      const isValid = crypto.timingSafeEqual(hash, storedHash);

      if (!isValid) {
        await this.handleFailedLogin(ipAddress);
        return false;
      }

      // Update login metrics
      this.lastLoginAt = new Date();
      this.lastIpAddress = ipAddress;
      this.failedLoginAttempts = 0;
      this.logSecurityEvent('successful_login', { ipAddress });
      await this.save();

      return true;

    } catch (err) {
      error('Error verifying password', err);
      return false;
    }
  }

  /**
   * Generates and encrypts new MFA secret
   */
  public async generateMFASecret(): Promise<string> {
    try {
      // Generate secure random secret
      const secret = crypto.randomBytes(20).toString('base64');

      // Encrypt secret using KMS
      const encryptCommand = new EncryptCommand({
        KeyId: process.env.KMS_KEY_ID,
        Plaintext: Buffer.from(secret)
      });
      const { CiphertextBlob } = await kmsClient.send(encryptCommand);

      // Update user properties
      this.mfaSecret = CiphertextBlob!.toString('base64');
      this.mfaEnabled = false;
      this.logSecurityEvent('mfa_secret_generated');
      await this.save();

      return secret;

    } catch (err) {
      error('Error generating MFA secret', err);
      throw new Error('Failed to generate MFA secret');
    }
  }

  /**
   * Checks if user has specific permission
   */
  public hasPermission(permission: string): boolean {
    try {
      if (this.status !== UserStatus.ACTIVE) {
        return false;
      }

      const rolePermissions = ROLE_PERMISSIONS[this.role];
      return rolePermissions.includes('*') || rolePermissions.includes(permission);

    } catch (err) {
      error('Error checking permission', err);
      return false;
    }
  }

  /**
   * Validates password complexity requirements
   */
  private validatePasswordComplexity(password: string): boolean {
    const minLength = 12;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return password.length >= minLength &&
           hasUpperCase &&
           hasLowerCase &&
           hasNumbers &&
           hasSpecialChars;
  }

  /**
   * Handles failed login attempt
   */
  private async handleFailedLogin(ipAddress: string): Promise<void> {
    this.failedLoginAttempts += 1;
    
    if (this.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
      this.status = UserStatus.LOCKED;
      this.lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60000);
      this.logSecurityEvent('account_locked', { ipAddress });
    } else {
      this.logSecurityEvent('failed_login', { ipAddress });
    }

    await this.save();
  }

  /**
   * Checks if account is currently locked
   */
  private isLocked(): boolean {
    if (this.status !== UserStatus.LOCKED || !this.lockoutUntil) {
      return false;
    }
    return this.lockoutUntil > new Date();
  }

  /**
   * Logs security-related events
   */
  private logSecurityEvent(event: string, metadata: object = {}): void {
    this.securityAuditLog = [
      ...this.securityAuditLog,
      {
        event,
        timestamp: new Date(),
        metadata: {
          ...metadata,
          userId: this.id
        }
      }
    ];
  }
}

export default User;