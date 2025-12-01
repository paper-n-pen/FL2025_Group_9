// backend/scripts/add-review-count-column.js
// Migration script to add review_count column to users table

const { pool } = require('../db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add review_count column to users table if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'review_count'
        ) THEN
          ALTER TABLE users ADD COLUMN review_count INTEGER NOT NULL DEFAULT 0;
          RAISE NOTICE 'Added review_count column to users table';
        ELSE
          RAISE NOTICE 'review_count column already exists';
        END IF;
      END $$;
    `);

    await client.query('COMMIT');
    console.log('✅ review_count column migration completed');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ review_count column migration failed', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { migrate };

