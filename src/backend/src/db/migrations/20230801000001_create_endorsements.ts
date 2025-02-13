/**
 * @file Database migration for creating the endorsements table
 * @version 1.0.0
 * @description Implements the endorsement data structure with comprehensive schema,
 * constraints and indexes for the MGA Operating System
 */

import { Knex } from 'knex'; // ^2.5.1
import { PolicyType } from '../../constants/policyTypes';

/**
 * Creates the endorsements table with all required fields, constraints and optimized indexes
 */
export async function up(knex: Knex): Promise<void> {
    // Enable UUID generation
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Create endorsements table
    await knex.schema.createTable('endorsements', (table) => {
        // Primary key
        table.uuid('id')
            .primary()
            .defaultTo(knex.raw('uuid_generate_v4()'))
            .notNullable();

        // Foreign key to policies table
        table.uuid('policy_id')
            .notNullable()
            .references('id')
            .inTable('policies')
            .onDelete('CASCADE')
            .index();

        // Endorsement type with policy type validation
        table.string('type', 50)
            .notNullable()
            .checkIn(Object.values(PolicyType));

        // Effective date of the endorsement
        table.timestamp('effective_date')
            .notNullable()
            .index();

        // JSONB column for flexible endorsement changes
        table.jsonb('changes')
            .notNullable()
            .comment('Structured endorsement changes in JSON format');

        // Premium change amount with validation
        table.decimal('premium_change', 15, 2)
            .notNullable()
            .comment('Net premium change amount');

        // Audit timestamps
        table.timestamp('created_at')
            .notNullable()
            .defaultTo(knex.fn.now());
        table.timestamp('updated_at')
            .notNullable()
            .defaultTo(knex.fn.now());

        // Add check constraint for premium change validation
        table.check(
            '?? >= -999999999999.99 AND ?? <= 999999999999.99',
            ['premium_change', 'premium_change'],
            'chk_endorsement_premium_change_range'
        );

        // Add check constraint for effective date validation
        table.check(
            '?? >= created_at',
            ['effective_date'],
            'chk_endorsement_effective_date'
        );
    });

    // Create composite index for common queries
    await knex.schema.raw(`
        CREATE INDEX idx_endorsements_policy_effective 
        ON endorsements (policy_id, effective_date);
    `);

    // Create trigger for updated_at maintenance
    await knex.raw(`
        CREATE OR REPLACE FUNCTION update_endorsement_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';

        CREATE TRIGGER trg_endorsement_timestamp
        BEFORE UPDATE ON endorsements
        FOR EACH ROW
        EXECUTE FUNCTION update_endorsement_timestamp();
    `);

    // Add JSONB validation constraint
    await knex.raw(`
        ALTER TABLE endorsements
        ADD CONSTRAINT chk_endorsement_changes_schema
        CHECK (jsonb_typeof(changes) = 'object');
    `);
}

/**
 * Drops the endorsements table and all related constraints and indexes
 */
export async function down(knex: Knex): Promise<void> {
    // Drop trigger
    await knex.raw('DROP TRIGGER IF EXISTS trg_endorsement_timestamp ON endorsements');
    await knex.raw('DROP FUNCTION IF EXISTS update_endorsement_timestamp');

    // Drop table (will cascade and remove indexes/constraints)
    await knex.schema.dropTableIfExists('endorsements');
}