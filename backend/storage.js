// backend/storage.js
// Helper functions for database-backed user operations

const { pool } = require('./db');
const { normalizeEmail } = require('./utils/userNormalization');

const userSelectFields = `id, username, email, password_hash, user_type, bio, education, specialties,
            rate_per_10_min, created_at, updated_at`;

const mapUserRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    password_hash: row.password_hash,
    user_type: row.user_type || 'student',
    bio: row.bio,
    education: row.education,
    specialties: row.specialties || [],
    rate_per_10_min: row.rate_per_10_min !== null && row.rate_per_10_min !== undefined
      ? Number(row.rate_per_10_min)
      : null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
};

const findUserByEmail = async (email, userType) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const params = [normalizedEmail];
  let query = `SELECT ${userSelectFields}
     FROM users
     WHERE LOWER(email) = LOWER($1)`;

  if (userType) {
    query += ` AND user_type = $2`;
    params.push(userType);
  }

  query += ` ORDER BY created_at ASC`;

  const result = await pool.query(query, params);
  return mapUserRow(result.rows[0]);
};

const findUserById = async (id) => {
  const result = await pool.query(
    `SELECT ${userSelectFields}
     FROM users
     WHERE id = $1`,
    [id]
  );
  return mapUserRow(result.rows[0]);
};

const updateUserPasswordById = async (userId, hashedPassword) => {
  const result = await pool.query(
    `UPDATE users
     SET password_hash = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [userId, hashedPassword]
  );
  return result.rowCount > 0;
};

module.exports = {
  findUserByEmail,
  findUserById,
  updateUserPasswordById
};
