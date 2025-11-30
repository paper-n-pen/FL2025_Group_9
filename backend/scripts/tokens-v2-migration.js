// backend/scripts/tokens-v2-migration.js
// Clean migration for tokens V2 system
const { pool } = require('../db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Ensure users.tokens exists
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS tokens INTEGER NOT NULL DEFAULT 0;
    `);

    // 2) Ensure sessions.tokens_charged exists (rename from tokens_transferred if needed)
    await client.query(`
      DO $$
      BEGIN
        -- Check if tokens_transferred exists but tokens_charged doesn't
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'sessions' AND column_name = 'tokens_transferred'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'sessions' AND column_name = 'tokens_charged'
        ) THEN
          ALTER TABLE sessions RENAME COLUMN tokens_transferred TO tokens_charged;
        ELSIF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'sessions' AND column_name = 'tokens_charged'
        ) THEN
          ALTER TABLE sessions ADD COLUMN tokens_charged BOOLEAN NOT NULL DEFAULT FALSE;
        END IF;
      END $$;
    `);

    // 3) Reset all balances to known state
    await client.query(`
      UPDATE users
      SET tokens = CASE
        WHEN user_type = 'student' THEN 100
        WHEN user_type = 'tutor'   THEN 0
        ELSE 0
      END;
    `);

    // 4) Reset all sessions
    await client.query(`
      UPDATE sessions
      SET tokens_charged = FALSE;
    `);

    await client.query('COMMIT');
    console.log('✅ tokens-v2 migration completed');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ tokens-v2 migration failed', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { migrate };

