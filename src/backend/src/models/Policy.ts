/**
 * @file Policy model implementation for MGA Operating System
 * @version 1.0.0
 * @maintainers MGA OS Platform Team
 */

import { Model, DataTypes, ValidationError } from 'sequelize'; // ^6.32.1
import { IPolicy, PolicyStatus, ICoverage, IUnderwritingInfo } from '../types/policy.types';
import { PolicyType, isPolicyType } from '../constants/policyTypes';

/**
 * Model class representing insurance policies in the MGA Operating System.
 * Implements comprehensive policy data structure with validation and relationship management.
 */
@Table({
  tableName: 'policies',
  timestamps: true,
  paranoid: true,
  indexes: [
    { unique: true, fields: ['policyNumber'] },
    { fields: ['status'] },
    { fields: ['type'] },
    { fields: ['oneShieldPolicyId'] }
  ]
})
export class Policy extends Model implements IPolicy {
  @Column({
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  })
  public id!: string;

  @Column({
    type: DataTypes.STRING(20),
    unique: true,
    allowNull: false
  })
  public policyNumber!: string;

  @Column({
    type: DataTypes.ENUM(...Object.values(PolicyType)),
    allowNull: false
  })
  public type!: PolicyType;

  @Column({
    type: DataTypes.ENUM(...Object.values(PolicyStatus)),
    allowNull: false,
    defaultValue: PolicyStatus.DRAFT
  })
  public status!: PolicyStatus;

  @Column({
    type: DataTypes.DATE,
    allowNull: false
  })
  public effectiveDate!: Date;

  @Column({
    type: DataTypes.DATE,
    allowNull: false
  })
  public expirationDate!: Date;

  @Column({
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  })
  public premium!: number;

  @Column({
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  })
  public coverages!: ICoverage[];

  @Column({
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  })
  public underwritingInfo!: IUnderwritingInfo;

  @Column({
    type: DataTypes.STRING,
    allowNull: true
  })
  public oneShieldPolicyId?: string;

  @Column({
    type: DataTypes.DATE,
    allowNull: false
  })
  public createdAt!: Date;

  @Column({
    type: DataTypes.DATE,
    allowNull: false
  })
  public updatedAt!: Date;

  @Column({
    type: DataTypes.DATE,
    allowNull: true
  })
  public deletedAt?: Date;

  /**
   * Initializes a new Policy instance with provided values and defaults
   * @param values Initial policy values
   */
  constructor(values?: Partial<IPolicy>) {
    super();
    if (values) {
      Object.assign(this, values);
      this.status = values.status || PolicyStatus.DRAFT;
      this.coverages = values.coverages || [];
      this.underwritingInfo = values.underwritingInfo || {
        riskScore: 0,
        underwriterNotes: ''
      };
      if (!this.policyNumber) {
        this.policyNumber = this.generatePolicyNumber();
      }
    }
  }

  /**
   * Validates policy data before save
   * @throws ValidationError if validation fails
   */
  public async validate(): Promise<void> {
    // Validate required fields
    if (!this.type || !isPolicyType(this.type)) {
      throw new ValidationError('Invalid policy type');
    }

    if (!this.effectiveDate || !this.expirationDate) {
      throw new ValidationError('Effective and expiration dates are required');
    }

    // Validate date range
    if (this.effectiveDate >= this.expirationDate) {
      throw new ValidationError('Effective date must be before expiration date');
    }

    // Validate premium
    if (this.premium < 0 || this.premium > 1000000000) {
      throw new ValidationError('Premium amount is invalid');
    }

    // Validate status transitions
    if (this.status === PolicyStatus.ACTIVE && !this.oneShieldPolicyId) {
      throw new ValidationError('OneShield policy ID is required for active policies');
    }

    // Validate coverages
    if (!Array.isArray(this.coverages) || this.coverages.length === 0) {
      throw new ValidationError('At least one coverage is required');
    }

    for (const coverage of this.coverages) {
      if (!coverage.type || !coverage.limits || !coverage.deductible) {
        throw new ValidationError('Invalid coverage structure');
      }
    }

    // Validate underwriting info for bound/active policies
    if ([PolicyStatus.BOUND, PolicyStatus.ACTIVE].includes(this.status)) {
      if (!this.underwritingInfo.riskScore || !this.underwritingInfo.underwriterNotes) {
        throw new ValidationError('Complete underwriting information required');
      }
    }

    await super.validate();
  }

  /**
   * Converts policy instance to API-friendly JSON representation
   * @returns Formatted policy object
   */
  public toJSON(): IPolicy {
    const json = super.toJSON() as IPolicy;
    
    // Format dates
    json.effectiveDate = this.effectiveDate.toISOString();
    json.expirationDate = this.expirationDate.toISOString();
    json.createdAt = this.createdAt.toISOString();
    json.updatedAt = this.updatedAt.toISOString();

    // Format premium
    json.premium = Number(this.premium.toFixed(2));

    // Mask sensitive underwriting data
    if (json.underwritingInfo) {
      delete json.underwritingInfo.approvedBy;
      delete json.underwritingInfo.underwriterNotes;
    }

    return json;
  }

  /**
   * Generates a unique policy number
   * @private
   * @returns Generated policy number
   */
  private generatePolicyNumber(): string {
    const prefix = this.type.substring(0, 2);
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
  }
}

export default Policy;