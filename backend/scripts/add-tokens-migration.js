// backend/scripts/add-tokens-migration.js
// Migration script to add tokens column to users table and tokens_transferred to sessions table

const { pool } = require('../db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Add tokens column to users table if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'tokens'
        ) THEN
          ALTER TABLE users ADD COLUMN tokens INTEGER NOT NULL DEFAULT 0;
        END IF;
      END $$;
    `);

    // 2) Add tokens_transferred column to sessions table if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'sessions' AND column_name = 'tokens_transferred'
        ) THEN
          ALTER TABLE sessions ADD COLUMN tokens_transferred BOOLEAN NOT NULL DEFAULT FALSE;
        END IF;
      END $$;
    `);

    // 3) Backfill initial tokens:
    //    - Students: Reset to 100 if they have 0 or NULL (but keep transaction balances if > 100)
    //    - Tutors: ALWAYS reset to 0 (they earn coins from sessions)
    const backfillResult = await client.query(`
      UPDATE users
         SET tokens = CASE
                        WHEN user_type = 'student' AND (tokens IS NULL OR tokens = 0) THEN 100
                        WHEN user_type = 'student' AND tokens > 100 THEN tokens  -- Keep transaction balances
                        WHEN user_type = 'student' THEN 100  -- Safety: any other case
                        WHEN user_type = 'tutor' THEN 0  -- ALWAYS reset tutors to 0
                        ELSE tokens
                      END
       WHERE (tokens IS NULL) 
          OR (user_type = 'student' AND tokens = 0)
          OR (user_type = 'tutor' AND tokens != 0);  -- Reset all tutors
    `);

    console.log(
      '✅ Backfill completed: users updated =',
      backfillResult.rowCount
    );

    // 4) Log detailed distribution for verification
    const verifyResult = await client.query(`
      SELECT user_type,
             COUNT(*)                         AS total,
             SUM(CASE WHEN user_type = 'student' AND tokens = 100 THEN 1 ELSE 0 END) AS students_with_100,
             SUM(CASE WHEN user_type = 'tutor'   AND tokens = 0   THEN 1 ELSE 0 END) AS tutors_with_0,
             SUM(CASE WHEN user_type = 'student' AND tokens != 100 THEN 1 ELSE 0 END) AS students_other,
             SUM(CASE WHEN user_type = 'tutor'   AND tokens != 0   THEN 1 ELSE 0 END) AS tutors_other
        FROM users
    GROUP BY user_type;
    `);

    console.log('📊 Current user token state:', verifyResult.rows);

    // 5) Sample a few rows for manual verification
    const sampleResult = await client.query(`
      SELECT id, username, user_type, tokens 
        FROM users 
    ORDER BY id ASC 
       LIMIT 10;
    `);
    console.log('📋 Sample users (first 10):', sampleResult.rows);

    await client.query('COMMIT');
    console.log('✅ Migration completed: tokens + tokens_transferred columns ensured');
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
