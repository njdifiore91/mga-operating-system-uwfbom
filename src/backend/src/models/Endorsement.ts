/**
 * @file Endorsement model implementation for MGA Operating System
 * @version 1.0.0
 * @maintainers MGA OS Platform Team
 */

import { Model, DataTypes, ValidationError } from 'sequelize'; // ^6.32.1
import { IEndorsement } from '../types/policy.types';
import { Policy } from './Policy';

/**
 * Enum defining endorsement status values
 */
enum EndorsementStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    CANCELLED = 'CANCELLED',
    SYNCED = 'SYNCED'
}

/**
 * Model class representing policy endorsements with comprehensive validation,
 * relationship definitions, and carrier integration support
 */
@Table({
    tableName: 'endorsements',
    timestamps: true,
    indexes: [
        { fields: ['policyId'] },
        { fields: ['effectiveDate'] },
        { fields: ['status'] },
        { fields: ['carrierReference'] }
    ]
})
export class Endorsement extends Model implements IEndorsement {
    @Column({
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    })
    public id!: string;

    @Column({
        type: DataTypes.STRING(100),
        allowNull: false
    })
    public type!: string;

    @Column({
        type: DataTypes.DATE,
        allowNull: false
    })
    public effectiveDate!: Date;

    @Column({
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
    })
    public changes!: Record<string, unknown>;

    @Column({
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: -1000000000,
            max: 1000000000
        }
    })
    public premiumChange!: number;

    @Column({
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'policies',
            key: 'id'
        }
    })
    public policyId!: string;

    @Column({
        type: DataTypes.ENUM(...Object.values(EndorsementStatus)),
        allowNull: false,
        defaultValue: EndorsementStatus.PENDING
    })
    public status!: EndorsementStatus;

    @Column({
        type: DataTypes.STRING,
        allowNull: true
    })
    public carrierReference?: string;

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

    /**
     * Initializes a new Endorsement instance with enhanced validation and default values
     * @param values Initial endorsement values
     */
    constructor(values?: Partial<IEndorsement>) {
        super();
        if (values) {
            Object.assign(this, values);
            this.status = EndorsementStatus.PENDING;
            this.changes = values.changes || {};
            this.premiumChange = values.premiumChange || 0;
            this.carrierReference = null;
        }
    }

    /**
     * Validates endorsement data before save with comprehensive business rules
     * @throws ValidationError if validation fails
     */
    public async validate(): Promise<void> {
        // Validate required fields
        if (!this.type || !this.effectiveDate || !this.policyId) {
            throw new ValidationError('Type, effective date, and policy ID are required');
        }

        // Validate effective date is in future
        if (this.effectiveDate <= new Date()) {
            throw new ValidationError('Effective date must be in the future');
        }

        // Validate premium change
        if (isNaN(this.premiumChange)) {
            throw new ValidationError('Invalid premium change amount');
        }

        // Validate changes object
        if (!this.changes || typeof this.changes !== 'object') {
            throw new ValidationError('Invalid changes structure');
        }

        // Validate policy exists
        const policy = await Policy.findByPk(this.policyId);
        if (!policy) {
            throw new ValidationError('Referenced policy does not exist');
        }

        // Validate no conflicting endorsements
        const conflictingEndorsement = await Endorsement.findOne({
            where: {
                policyId: this.policyId,
                effectiveDate: this.effectiveDate,
                status: [EndorsementStatus.PENDING, EndorsementStatus.APPROVED],
                id: { [Op.ne]: this.id } // Exclude current endorsement
            }
        });

        if (conflictingEndorsement) {
            throw new ValidationError('Conflicting endorsement exists for the same date');
        }

        await super.validate();
    }

    /**
     * Converts endorsement instance to JSON representation with formatted values
     * @returns Enhanced JSON representation of endorsement
     */
    public toJSON(): IEndorsement {
        const json = super.toJSON() as IEndorsement;
        
        // Format dates
        json.effectiveDate = this.effectiveDate.toISOString();
        json.createdAt = this.createdAt.toISOString();
        json.updatedAt = this.updatedAt.toISOString();

        // Format premium change
        json.premiumChange = Number(this.premiumChange.toFixed(2));

        // Add carrier integration status
        json.carrierStatus = this.carrierReference ? 'SYNCED' : 'PENDING';

        return json;
    }

    /**
     * Synchronizes endorsement with carrier system
     * @throws Error if sync fails
     */
    public async syncWithCarrier(): Promise<void> {
        try {
            // Prepare endorsement data for carrier format
            const carrierPayload = {
                endorsementType: this.type,
                effectiveDate: this.effectiveDate.toISOString(),
                changes: this.changes,
                premiumAdjustment: this.premiumChange,
                policyReference: this.policyId
            };

            // Call carrier API integration (implementation depends on carrier service)
            const carrierResponse = await carrierService.syncEndorsement(carrierPayload);

            // Update carrier reference
            this.carrierReference = carrierResponse.referenceId;
            this.status = EndorsementStatus.SYNCED;
            await this.save();

        } catch (error) {
            this.status = EndorsementStatus.PENDING;
            await this.save();
            throw new Error(`Carrier sync failed: ${error.message}`);
        }
    }
}

// Define relationships
Endorsement.belongsTo(Policy, {
    foreignKey: 'policyId',
    as: 'policy'
});

export default Endorsement;