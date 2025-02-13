import { Knex } from 'knex'; // v2.5.1
import { PolicyType } from '../../constants/policyTypes';

/**
 * Creates the policies table with comprehensive schema design for the MGA Operating System
 * Implements optimized indexes and constraints for high-performance policy administration
 */
export async function up(knex: Knex): Promise<void> {
    // Enable UUID generation
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Create policy status type
    await knex.raw(`
        CREATE TYPE policy_status AS ENUM (
            'DRAFT',
            'ACTIVE', 
            'CANCELLED',
            'EXPIRED'
        )
    `);

    // Create policies table
    await knex.schema.createTable('policies', (table) => {
        // Primary key and identification
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('policy_number', 50).unique().notNullable();
        
        // Core policy fields
        table.enum('policy_type', Object.values(PolicyType)).notNullable();
        table.specificType('status', 'policy_status').notNullable().defaultTo('DRAFT');
        table.date('effective_date').notNullable();
        table.date('expiration_date').notNullable();
        table.decimal('premium_amount', 10, 2).notNullable();
        
        // Flexible JSON data structures
        table.jsonb('coverages').notNullable().defaultTo('{}');
        table.jsonb('underwriting_info').notNullable().defaultTo('{}');
        
        // Foreign key relationships
        table.uuid('carrier_id').notNullable()
            .references('id')
            .inTable('carriers')
            .onDelete('RESTRICT');
            
        table.uuid('broker_id').notNullable()
            .references('id')
            .inTable('brokers')
            .onDelete('RESTRICT');
            
        // Audit timestamps
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    });

    // Create optimized indexes
    await knex.schema.raw(`
        -- B-tree index for policy number lookups
        CREATE INDEX idx_policies_policy_number ON policies USING btree (policy_number);
        
        -- Composite index for policy type and status queries
        CREATE INDEX idx_policies_type_status ON policies (policy_type, status);
        
        -- Date range indexes
        CREATE INDEX idx_policies_effective_date ON policies (effective_date);
        CREATE INDEX idx_policies_expiration_date ON policies (expiration_date);
        
        -- Partial index for active policies
        CREATE INDEX idx_policies_active ON policies (status) WHERE status = 'ACTIVE';
        
        -- GiST index for JSONB coverage queries
        CREATE INDEX idx_policies_coverages ON policies USING gin (coverages);
        
        -- Add constraints
        ALTER TABLE policies 
            ADD CONSTRAINT chk_policies_premium_amount 
            CHECK (premium_amount >= 0);
            
        ALTER TABLE policies 
            ADD CONSTRAINT chk_policies_dates 
            CHECK (expiration_date > effective_date);
            
        -- Trigger for updated_at
        CREATE TRIGGER set_policies_updated_at
            BEFORE UPDATE ON policies
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    `);
}

/**
 * Rolls back the policies table creation by dropping the table and related objects
 */
export async function down(knex: Knex): Promise<void> {
    await knex.schema.raw(`
        -- Drop indexes
        DROP INDEX IF EXISTS idx_policies_policy_number;
        DROP INDEX IF EXISTS idx_policies_type_status;
        DROP INDEX IF EXISTS idx_policies_effective_date;
        DROP INDEX IF EXISTS idx_policies_expiration_date;
        DROP INDEX IF EXISTS idx_policies_active;
        DROP INDEX IF EXISTS idx_policies_coverages;
        
        -- Drop trigger
        DROP TRIGGER IF EXISTS set_policies_updated_at ON policies;
    `);

    // Drop the policies table
    await knex.schema.dropTableIfExists('policies');

    // Drop the policy status enum type
    await knex.raw('DROP TYPE IF EXISTS policy_status');
}