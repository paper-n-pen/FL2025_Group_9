// backend/scripts/db-check.js
// Check database roles, tables, and counts

const { pool } = require('../db');

async function checkDatabase() {
  try {
    console.log('🔍 Checking database...');
    
    // Check if users table exists and get count
    const usersResult = await pool.query(`
      SELECT COUNT(*) as count FROM users;
    `);
    console.log(`   Users table: ${usersResult.rows[0].count} records`);
    
    // Check if tutors exist
    const tutorsResult = await pool.query(`
      SELECT COUNT(*) as count FROM users WHERE user_type = 'tutor';
    `);
    console.log(`   Tutors: ${tutorsResult.rows[0].count} records`);
    
    // Check if students exist
    const studentsResult = await pool.query(`
      SELECT COUNT(*) as count FROM users WHERE user_type = 'student';
    `);
    console.log(`   Students: ${studentsResult.rows[0].count} records`);
    
    // Check tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log(`   Tables: ${tablesResult.rows.map(r => r.table_name).join(', ')}`);
    
    console.log('✅ Database check complete');
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  }
}

if (require.main === module) {
  checkDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { checkDatabase };

