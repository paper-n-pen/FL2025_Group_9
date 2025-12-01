// backend/scripts/fix-query-acceptances-constraint.js
// Fix the check constraint on query_acceptances.status to allow EXPIRED and DISMISSED

const { pool } = require('../db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Create query_acceptances table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS query_acceptances (
        id BIGSERIAL PRIMARY KEY,
        query_id BIGINT NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
        tutor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        accepted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (query_id, tutor_id)
      );
    `);

    // 2) Drop the old check constraint if it exists
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.constraint_column_usage
          WHERE constraint_name = 'check_status' AND table_name = 'query_acceptances'
        ) THEN
          ALTER TABLE query_acceptances DROP CONSTRAINT check_status;
        END IF;
      END $$;
    `);

    // 3) Add the new check constraint that allows all statuses we need
    await client.query(`
      ALTER TABLE query_acceptances
      ADD CONSTRAINT check_status 
      CHECK (status IN ('PENDING', 'SELECTED', 'REJECTED', 'EXPIRED', 'DISMISSED'));
    `);

    // 4) Create indexes if they don't exist
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_query_acceptances_query_id 
      ON query_acceptances(query_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_query_acceptances_tutor_id 
      ON query_acceptances(tutor_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_query_acceptances_status 
      ON query_acceptances(status);
    `);

    await client.query('COMMIT');
    console.log('✅ Fixed query_acceptances constraint - now allows PENDING, SELECTED, REJECTED, EXPIRED, DISMISSED');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrate()
    .then(() => {
      console.log('Migration script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script error:', error);
      process.exit(1);
    });
}

module.exports = { migrate };




