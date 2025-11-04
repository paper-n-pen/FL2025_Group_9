const nodemailer = require('nodemailer');
const { pool } = require('./db');

const stripTrailingSlash = (value = '') => value.replace(/\/+$/, '');

const FRONTEND_BASE_URL = (() => {
  const raw = process.env.FRONTEND_BASE_URL || process.env.APP_FRONTEND_URL;
  if (raw) {
    return stripTrailingSlash(raw);
  }

  if (process.env.NODE_ENV === 'production') {
    return 'http://localhost';
  }

  return 'http://localhost:5173';
})();

const buildFrontendUrl = (path = '/') => {
  try {
    const base = `${FRONTEND_BASE_URL}/`;
    return new URL(path, base).toString();
  } catch (error) {
    const sanitizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${FRONTEND_BASE_URL}${sanitizedPath}`;
  }
};

// Create transporter (using Gmail for demo - in production use proper SMTP)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

const generateResetToken = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = buildFrontendUrl(`/reset-password?token=${resetToken}`);
  
  const mailOptions = {
    from: process.env.EMAIL_USER || 'your-email@gmail.com',
    to: email,
    subject: 'MicroTutor - Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e3a8a; text-align: center;">MicroTutor</h2>
        <h3 style="color: #374151;">Password Reset Request</h3>
        <p>You requested to reset your password for your MicroTutor account.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #1e3a8a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${resetUrl}">${resetUrl}</a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          This link will expire in 1 hour for security reasons.
        </p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          If you didn't request this password reset, please ignore this email.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

const storeResetToken = async (userId, token) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
    await client.query(
      `INSERT INTO password_reset_tokens (token, user_id, expires_at, used, used_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '1 hour', FALSE, NULL)`,
      [token, userId]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const isTokenActive = (row) => {
  if (!row) {
    return false;
  }

  if (row.used) {
    return false;
  }

  const expiresAt = new Date(row.expires_at);
  if (Number.isNaN(expiresAt.getTime())) {
    return false;
  }

  return expiresAt.getTime() > Date.now();
};

const validateResetToken = async (token) => {
  const result = await pool.query(
    `SELECT token, expires_at, used
     FROM password_reset_tokens
     WHERE token = $1`,
    [token]
  );

  const tokenRow = result.rows[0];

  if (!isTokenActive(tokenRow)) {
    if (tokenRow && new Date(tokenRow.expires_at).getTime() <= Date.now()) {
      await pool.query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
    }
    return false;
  }

  return true;
};

const markTokenAsUsed = async (token) => {
  await pool.query(
    `UPDATE password_reset_tokens
     SET used = TRUE,
         used_at = CURRENT_TIMESTAMP
     WHERE token = $1`,
    [token]
  );
};

const getResetTokenUser = async (token) => {
  const result = await pool.query(
    `SELECT u.id, u.email, prt.expires_at, prt.used
     FROM password_reset_tokens prt
     JOIN users u ON u.id = prt.user_id
     WHERE prt.token = $1`,
    [token]
  );

  const row = result.rows[0];
  if (!isTokenActive(row)) {
    return null;
  }

  return { id: row.id, email: row.email };
};

module.exports = {
  sendPasswordResetEmail,
  storeResetToken,
  validateResetToken,
  markTokenAsUsed,
  getResetTokenUser,
  generateResetToken
};
