/**
 * @fileoverview Database migration for creating the claims table with comprehensive schema design
 * for the MGA Operating System. Implements core claims data structure with required fields,
 * constraints, and performance optimizations for OneShield integration.
 * 
 * @version 1.0.0
 * @knex ^2.5.1
 */

import { Knex } from 'knex'; // ^2.5.1
import { CLAIM_STATUS } from '../../constants/claimStatus';

/**
 * Creates the claims table with comprehensive schema including all required fields,
 * constraints, and performance optimizations.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('claims', (table) => {
    // Primary key and relationship columns
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('policy_id').notNullable().references('id').inTable('policies').onDelete('CASCADE');
    table.string('claim_number', 50).unique().notNullable();

    // Core claim details
    table.enum('status', Object.values(CLAIM_STATUS)).notNullable().defaultTo(CLAIM_STATUS.NEW);
    table.timestamp('incident_date').notNullable();
    table.timestamp('reported_date').notNullable();
    table.text('description').notNullable();

    // Location and claimant information using JSONB for flexibility
    table.jsonb('location').notNullable().defaultTo('{}');
    table.jsonb('claimant_info').notNullable().defaultTo('{}');

    // Financial tracking
    table.decimal('reserve_amount', 15, 2).notNullable().defaultTo(0);
    table.decimal('paid_amount', 15, 2).notNullable().defaultTo(0);

    // Document references
    table.jsonb('documents').notNullable().defaultTo('[]');

    // Metadata and timestamps
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Indexes for performance optimization
    table.index(['policy_id'], 'idx_claims_policy_id');
    table.index(['status'], 'idx_claims_status');
    table.index(['claim_number'], 'idx_claims_claim_number');
    
    // Partial index for active claims
    knex.raw(`
      CREATE INDEX idx_claims_active_status ON claims (status)
      WHERE status IN ('NEW', 'UNDER_REVIEW', 'PENDING_INFO', 'APPROVED', 'IN_PAYMENT', 'REOPENED')
    `);

    // Index for date range queries
    table.index(['incident_date'], 'idx_claims_incident_date');
    table.index(['reported_date'], 'idx_claims_reported_date');

    // Composite index for common query patterns
    table.index(['policy_id', 'status'], 'idx_claims_policy_status');
  });

  // Create trigger for updating updated_at timestamp
  await knex.raw(`
    CREATE TRIGGER update_claims_updated_at
    BEFORE UPDATE ON claims
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

/**
 * Rolls back the claims table creation by removing all related constraints,
 * triggers, and the table itself.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TRIGGER IF EXISTS update_claims_updated_at ON claims');
  await knex.schema.dropTableIfExists('claims');
}