import { Knex } from 'knex'; // ^2.5.1

export async function up(knex: Knex): Promise<void> {
  // Enable UUID generation
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  await knex.schema.createTable('documents', (table) => {
    // Primary key
    table.uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'))
      .notNullable();

    // File metadata
    table.string('file_name', 255).notNullable();
    table.string('file_type', 100).notNullable();
    table.bigInteger('file_size').notNullable();

    // AWS S3 storage information
    table.string('s3_key', 512).notNullable();
    table.string('s3_bucket', 255).notNullable();

    // Document classification
    table.string('document_type', 100).notNullable();

    // Relationships
    table.uuid('policy_id')
      .references('id')
      .inTable('policies')
      .onDelete('CASCADE');
      
    table.uuid('claim_id')
      .references('id')
      .inTable('claims')
      .onDelete('CASCADE');

    // Audit columns
    table.timestamp('uploaded_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
      
    table.timestamp('deleted_at', { useTz: true });
    
    table.uuid('uploaded_by')
      .notNullable()
      .references('id')
      .inTable('users');

    // Security
    table.boolean('is_encrypted')
      .notNullable()
      .defaultTo(false);
  });

  // Create indexes for performance optimization
  await knex.schema.raw(
    'CREATE INDEX idx_documents_policy_id ON documents USING btree (policy_id)'
  );
  
  await knex.schema.raw(
    'CREATE INDEX idx_documents_claim_id ON documents USING btree (claim_id)'
  );
  
  await knex.schema.raw(
    'CREATE INDEX idx_documents_document_type ON documents USING btree (document_type)'
  );
}

export async function down(knex: Knex): Promise<void> {
  // Drop indexes first
  await knex.schema.raw('DROP INDEX IF EXISTS idx_documents_policy_id');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_documents_claim_id');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_documents_document_type');

  // Drop the table
  await knex.schema.dropTableIfExists('documents');
}