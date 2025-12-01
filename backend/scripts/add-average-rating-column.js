// backend/scripts/add-average-rating-column.js
// Migration script to add average_rating column to users table

const { pool } = require('../db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add average_rating column to users table if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'average_rating'
        ) THEN
          ALTER TABLE users ADD COLUMN average_rating NUMERIC(3, 2);
          RAISE NOTICE 'Added average_rating column to users table';
        ELSE
          RAISE NOTICE 'average_rating column already exists';
        END IF;
      END $$;
    `);

    await client.query('COMMIT');
    console.log('✅ average_rating column migration completed');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ average_rating column migration failed', err);
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

