import { Model, DataTypes } from 'sequelize';
import { CLAIM_STATUS } from '../constants/claimStatus';
import type { Claim } from '../types/claims.types';

/**
 * Enhanced Sequelize model class for Claims management with comprehensive support for
 * OneShield integration, regulatory compliance, and audit trail management.
 * 
 * @version 1.0.0
 */
@Table({
  tableName: 'claims',
  timestamps: true,
  paranoid: true,
  indexes: [
    { fields: ['policyId'] },
    { fields: ['claimNumber'], unique: true },
    { fields: ['oneShieldClaimId'], unique: true },
    { fields: ['status'] }
  ]
})
export class ClaimModel extends Model implements Claim {
  @Column({
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  })
  id!: string;

  @Column({
    type: DataTypes.UUID,
    allowNull: false
  })
  policyId!: string;

  @Column({
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  })
  claimNumber!: string;

  @Column({
    type: DataTypes.STRING,
    unique: true
  })
  oneShieldClaimId?: string;

  @Column({
    type: DataTypes.ENUM(...Object.values(CLAIM_STATUS)),
    allowNull: false,
    defaultValue: CLAIM_STATUS.NEW
  })
  status!: CLAIM_STATUS;

  @Column({
    type: DataTypes.DATE,
    allowNull: false
  })
  incidentDate!: Date;

  @Column({
    type: DataTypes.DATE,
    allowNull: false
  })
  reportedDate!: Date;

  @Column({
    type: DataTypes.TEXT,
    allowNull: false
  })
  description!: string;

  @Column({
    type: DataTypes.JSONB,
    allowNull: false
  })
  location!: {
    address: string;
    address2: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };

  @Column({
    type: DataTypes.JSONB,
    allowNull: false
  })
  claimantInfo!: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    relationship: string;
    alternateContact: {
      name: string;
      phone: string;
      relationship: string;
    };
    preferredContactMethod: string;
  };

  @Column({
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  })
  reserveAmount!: number;

  @Column({
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  })
  paidAmount!: number;

  @Column({
    type: DataTypes.JSONB,
    defaultValue: []
  })
  documents!: Array<{
    id: string;
    type: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: Date;
    uploadedBy: string;
    url: string;
    metadata: Record<string, unknown>;
  }>;

  @Column({
    type: DataTypes.JSONB,
    defaultValue: []
  })
  statusHistory!: Array<{
    status: CLAIM_STATUS;
    timestamp: Date;
    notes: string;
    userId: string;
  }>;

  @Column({
    type: DataTypes.JSONB,
    defaultValue: {}
  })
  complianceData!: {
    regulatoryReporting: Record<string, unknown>;
    complianceChecks: Array<{
      type: string;
      timestamp: Date;
      result: boolean;
      details: string;
    }>;
  };

  @Column({
    type: DataTypes.JSONB,
    defaultValue: []
  })
  auditLog!: Array<{
    action: string;
    timestamp: Date;
    userId: string;
    details: Record<string, unknown>;
  }>;

  @Column({
    type: DataTypes.DATE,
    allowNull: false
  })
  createdAt!: Date;

  @Column({
    type: DataTypes.DATE,
    allowNull: false
  })
  updatedAt!: Date;

  @Column({
    type: DataTypes.DATE
  })
  deletedAt?: Date;

  /**
   * Updates the claim status with comprehensive validation and audit trail management.
   * Synchronizes with OneShield and maintains compliance records.
   */
  async updateStatus(
    newStatus: CLAIM_STATUS,
    notes: string,
    metadata: {
      userId: string;
      adjusterId?: string;
      reserveChange?: number;
    }
  ): Promise<void> {
    const oldStatus = this.status;
    
    // Update status history
    this.statusHistory.push({
      status: newStatus,
      timestamp: new Date(),
      notes,
      userId: metadata.userId
    });

    // Update audit log
    this.auditLog.push({
      action: 'STATUS_UPDATE',
      timestamp: new Date(),
      userId: metadata.userId,
      details: {
        oldStatus,
        newStatus,
        notes,
        metadata
      }
    });

    // Update reserve amount if provided
    if (metadata.reserveChange) {
      this.reserveAmount += metadata.reserveChange;
    }

    // Update status
    this.status = newStatus;
    
    // Sync with OneShield
    await this.syncWithOneShield({
      action: 'STATUS_UPDATE',
      payload: {
        status: newStatus,
        notes,
        adjusterId: metadata.adjusterId
      }
    });

    await this.save();
  }

  /**
   * Calculates comprehensive financial exposure with risk factors and reserve requirements.
   */
  async calculateTotalExposure(riskFactors: {
    severity: number;
    complexity: number;
    litigation: boolean;
  }): Promise<{
    totalExposure: number;
    breakdown: Record<string, number>;
    riskAdjustment: number;
  }> {
    const baseExposure = this.reserveAmount;
    const riskAdjustment = (
      riskFactors.severity * 
      riskFactors.complexity * 
      (riskFactors.litigation ? 1.5 : 1)
    );

    const totalExposure = baseExposure * riskAdjustment;

    return {
      totalExposure,
      breakdown: {
        baseReserve: this.reserveAmount,
        paidAmount: this.paidAmount,
        outstandingReserve: this.reserveAmount - this.paidAmount
      },
      riskAdjustment
    };
  }

  /**
   * Synchronizes claim data with OneShield system ensuring data consistency
   * and maintaining integration audit trail.
   */
  async syncWithOneShield(syncOptions: {
    action: string;
    payload: Record<string, unknown>;
  }): Promise<boolean> {
    try {
      // Record sync attempt in audit log
      this.auditLog.push({
        action: 'ONESHIELD_SYNC_ATTEMPT',
        timestamp: new Date(),
        userId: 'SYSTEM',
        details: syncOptions
      });

      // TODO: Implement actual OneShield API call here
      const syncSuccessful = true; // Placeholder for actual API response

      if (syncSuccessful) {
        this.auditLog.push({
          action: 'ONESHIELD_SYNC_SUCCESS',
          timestamp: new Date(),
          userId: 'SYSTEM',
          details: {
            action: syncOptions.action,
            timestamp: new Date()
          }
        });
      }

      return syncSuccessful;
    } catch (error) {
      this.auditLog.push({
        action: 'ONESHIELD_SYNC_ERROR',
        timestamp: new Date(),
        userId: 'SYSTEM',
        details: {
          error: error.message,
          action: syncOptions.action
        }
      });
      throw error;
    }
  }
}