// backend/routes/queries.js
const express = require('express');
const { pool } = require('../db');

const router = express.Router();

let io;
const setIO = (socketIO) => {
  io = socketIO;
};

const mapQueryRow = (row, overrides = {}) => ({
  id: row.id.toString(),
  subject: row.subject,
  subtopic: row.subtopic,
  query: row.query_text,
  studentId: row.student_id,
  studentName: row.student_name,
  status: row.status,
  timestamp: row.created_at,
  acceptedTutorId: row.accepted_tutor_id ? row.accepted_tutor_id.toString() : null,
  ...overrides
});

// ------------------------
// OPTIONS handler middleware for all routes in this router
// ------------------------
router.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:8080,http://localhost,http://127.0.0.1')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);
    
    if (origin && corsOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
      return res.status(204).end();
    }
    
    return res.status(204).end();
  }
  next();
});

// ------------------------
// POST /queries/post
// ------------------------
router.post('/post', async (req, res) => {
  console.log('[QUERY POST] New query being posted');

  let { subject, subtopic, query, studentId } = req.body;

  if (!subject || !subtopic || !query || !studentId) {
    return res.status(400).json({ message: 'All fields required' });
  }

  // normalize/trim to avoid mismatches caused by stray spaces
  subject = String(subject).trim();
  subtopic = String(subtopic).trim();
  query = String(query).trim();

  const studentIdNumber = Number(studentId);
  if (!Number.isInteger(studentIdNumber)) {
    return res.status(400).json({ message: 'Invalid studentId' });
  }

  try {
    const studentResult = await pool.query(
      'SELECT id, username, user_type FROM users WHERE id = $1',
      [studentIdNumber]
    );
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    // Verify this is actually a student (case-insensitive check)
    const userType = String(studentResult.rows[0].user_type || '').toLowerCase();
    if (userType !== 'student') {
      console.error('[QUERY POST] ERROR: User is not a student', {
        userId: studentIdNumber,
        userType: studentResult.rows[0].user_type,
        userTypeLower: userType,
        username: studentResult.rows[0].username
      });
      return res.status(400).json({ 
        message: `Only students can post queries. Your account type is: ${studentResult.rows[0].user_type || 'unknown'}` 
      });
    }
    
    console.log('[QUERY POST] Student verified:', {
      studentId: studentIdNumber,
      username: studentResult.rows[0].username,
      userType: studentResult.rows[0].user_type
    });

    const insertResult = await pool.query(
      `INSERT INTO queries (subject, subtopic, query_text, student_id, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, subject, subtopic, query_text, student_id, status, created_at`,
      [subject, subtopic, query, studentIdNumber]
    );

    const newQuery = insertResult.rows[0];
    const notificationPayload = {
      id: newQuery.id.toString(),
      subject: newQuery.subject,
      subtopic: newQuery.subtopic,
      query: newQuery.query_text,
      studentId: studentIdNumber.toString(),
      studentName: studentResult.rows[0].username,
      timestamp: newQuery.created_at
    };

    console.log('New query posted:', {
      subject: newQuery.subject,
      subtopic: newQuery.subtopic,
      studentId: studentIdNumber
    });

    if (io) {
      // broadcast to all connected tutors; dashboards also poll
      io.emit('new-query', notificationPayload);
    }

    res.status(201).json({
      message: 'Query posted successfully',
      queryId: newQuery.id.toString()
    });
  } catch (error) {
    console.error('[QUERY POST] ERROR:', error);
    console.error('[QUERY POST] Error details:', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ------------------------
// GET /queries/tutor/:tutorId
// (forgiving specialty filter)
// ------------------------
router.get('/tutor/:tutorId', async (req, res) => {
  const tutorIdFromParam = Number(req.params.tutorId);
  if (!Number.isInteger(tutorIdFromParam)) {
    return res.status(400).json({ message: 'Invalid tutorId' });
  }

  // ✅ CRITICAL: Validate tutor ID from JWT token if available
  let authenticatedTutorId = null;
  try {
    const token = req.cookies?.token || req.cookies?.authToken;
    if (token) {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret-change-me");
      if (decoded.role === 'tutor') {
        authenticatedTutorId = Number(decoded.id);
        console.log('[NEW QUERIES] Authenticated tutor ID from JWT:', authenticatedTutorId);
      }
    }
  } catch (e) {
    // JWT verification failed, continue with param tutorId
  }

  // ✅ CRITICAL: If JWT tutor ID doesn't match param tutorId, use JWT ID (more secure)
  const finalTutorId = authenticatedTutorId && authenticatedTutorId !== tutorIdFromParam 
    ? authenticatedTutorId 
    : tutorIdFromParam;

  if (authenticatedTutorId && authenticatedTutorId !== tutorIdFromParam) {
    console.warn('[NEW QUERIES] 🚨 TUTOR ID MISMATCH - Using JWT ID instead of param ID:', {
      paramTutorId: tutorIdFromParam,
      jwtTutorId: authenticatedTutorId,
      action: 'Using JWT tutor ID for new queries'
    });
  }

  try {
    const tutorResult = await pool.query(
      `SELECT id, user_type, specialties, rate_per_10_min
         FROM users
        WHERE id = $1`,
      [finalTutorId]
    );

    if (tutorResult.rows.length === 0 || tutorResult.rows[0].user_type !== 'tutor') {
      return res.status(404).json({ message: 'Tutor not found' });
    }

    const tutorRow = tutorResult.rows[0];
    const tutorSpecialties = Array.isArray(tutorRow.specialties) ? tutorRow.specialties : [];
    const normalized = tutorSpecialties
      .map((s) => String(s).trim().toLowerCase())
      .filter(Boolean);

    const params = [finalTutorId];
    let sql = `
      SELECT q.id, q.subject, q.subtopic, q.query_text, q.student_id, q.status, q.created_at,
             q.accepted_tutor_id, s.username AS student_name
        FROM queries q
        JOIN users s ON s.id = q.student_id
       WHERE q.status IN ('pending', 'OPEN', 'PENDING_STUDENT_SELECTION')
         AND q.accepted_tutor_id IS NULL
         AND NOT EXISTS (
               SELECT 1 FROM query_declines d
                WHERE d.query_id = q.id AND d.tutor_id = $1
         )
         AND NOT EXISTS (
               SELECT 1 FROM query_acceptances qa
                WHERE qa.query_id = q.id AND qa.tutor_id = $1 AND qa.status IN ('REJECTED', 'PENDING', 'SELECTED')
         )
    `;

    // Only filter if the tutor actually has specialties.
    if (normalized.length > 0) {
      // ILIKE patterns for partial matching
      const patterns = normalized.map((s) => `%${s}%`);

      // push arrays in order and reference by index to keep numbering correct
      params.push(normalized); // $2
      params.push(normalized); // $3
      params.push(patterns);   // $4
      params.push(patterns);   // $5

      sql += `
        AND (
              LOWER(q.subtopic) = ANY($2::text[])
           OR LOWER(q.subject)  = ANY($3::text[])
           OR q.subtopic ILIKE ANY($4::text[])
           OR q.subject  ILIKE ANY($5::text[])
        )
      `;
    }

    sql += ' ORDER BY q.created_at DESC';

    const { rows } = await pool.query(sql, params);

    const rate =
      tutorRow.rate_per_10_min !== null && tutorRow.rate_per_10_min !== undefined
        ? Number(tutorRow.rate_per_10_min)
        : null;

    const serialized = rows.map((row) => mapQueryRow(row, { rate }));
    res.json(serialized);
  } catch (error) {
    console.error('Error fetching tutor queries:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ------------------------
// GET /queries/tutor/:tutorId/accepted-queries
// ------------------------
router.get('/tutor/:tutorId/accepted-queries', async (req, res) => {
  const tutorIdFromParam = Number(req.params.tutorId);
  if (!Number.isInteger(tutorIdFromParam)) {
    return res.status(400).json({ message: 'Invalid tutorId' });
  }

  // ✅ CRITICAL: Validate tutor ID from JWT token if available
  let authenticatedTutorId = null;
  try {
    const token = req.cookies?.token || req.cookies?.authToken;
    if (token) {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret-change-me");
      if (decoded.role === 'tutor') {
        authenticatedTutorId = Number(decoded.id);
        console.log('[ACCEPTED QUERIES] Authenticated tutor ID from JWT:', authenticatedTutorId);
      }
    }
  } catch (e) {
    // JWT verification failed, continue with param tutorId
  }

  // ✅ CRITICAL: If JWT tutor ID doesn't match param tutorId, use JWT ID (more secure)
  const finalTutorId = authenticatedTutorId && authenticatedTutorId !== tutorIdFromParam 
    ? authenticatedTutorId 
    : tutorIdFromParam;

  if (authenticatedTutorId && authenticatedTutorId !== tutorIdFromParam) {
    console.warn('[ACCEPTED QUERIES] 🚨 TUTOR ID MISMATCH - Using JWT ID instead of param ID:', {
      paramTutorId: tutorIdFromParam,
      jwtTutorId: authenticatedTutorId,
      action: 'Using JWT tutor ID for accepted queries'
    });
  }

  try {
    const tutorResult = await pool.query(
      `SELECT id, user_type, rate_per_10_min
         FROM users
        WHERE id = $1`,
      [finalTutorId]
    );

    if (tutorResult.rows.length === 0 || tutorResult.rows[0].user_type !== 'tutor') {
      return res.status(404).json({ message: 'Tutor not found' });
    }

    const tutorRow = tutorResult.rows[0];
    const rate =
      tutorRow.rate_per_10_min !== null && tutorRow.rate_per_10_min !== undefined
        ? Number(tutorRow.rate_per_10_min)
        : null;

    // Show queries where this tutor has accepted (PENDING, SELECTED, or EXPIRED status)
    // PENDING = waiting for student to choose
    // SELECTED = student chose this tutor, can start session
    // EXPIRED = another tutor was selected, show with dismiss option
    // ✅ Filter out queries where session has ended (session_status = 'ended')
    const queriesResult = await pool.query(
      `SELECT q.id,
              q.subject,
              q.subtopic,
              q.query_text,
              q.student_id,
              q.status,
              q.created_at,
              q.updated_at,
              q.accepted_tutor_id,
              s.username AS student_name,
              qa.status AS acceptance_status,
              latest_session.id AS session_id,
              latest_session.status AS session_status
         FROM queries q
         JOIN users s ON s.id = q.student_id
         JOIN query_acceptances qa ON qa.query_id = q.id AND qa.tutor_id = $1
    LEFT JOIN LATERAL (
           SELECT id, status
             FROM sessions
            WHERE query_id = q.id
         ORDER BY start_time DESC
            LIMIT 1
    ) latest_session ON TRUE
        WHERE qa.status IN ('PENDING', 'SELECTED', 'EXPIRED')
          AND (latest_session.status IS NULL OR latest_session.status != 'ended')
     ORDER BY COALESCE(q.updated_at, q.created_at) DESC`,
      [finalTutorId]
    );

    const acceptedQueries = queriesResult.rows.map((row) => {
      const mapped = mapQueryRow(row, {
        sessionId: row.session_id ? row.session_id.toString() : null,
        sessionStatus: row.session_status || null,
        rate
      });
      // Add acceptance status and accepted tutor ID to the response
      mapped.acceptanceStatus = row.acceptance_status || 'PENDING';
      mapped.acceptedTutorId = row.accepted_tutor_id ? row.accepted_tutor_id.toString() : null;
      return mapped;
    });

    res.json(acceptedQueries);
  } catch (error) {
    console.error('Error fetching accepted tutor queries:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ------------------------
// POST /queries/accept
// ------------------------
router.post('/accept', async (req, res) => {
  const { queryId, tutorId } = req.body;

  // ✅ CRITICAL: Log the raw request body to debug tutor ID issues
  console.log('[QUERY ACCEPT] Raw request body:', {
    queryId,
    tutorId,
    bodyKeys: Object.keys(req.body),
    fullBody: req.body
  });

  const queryIdNumber = Number(queryId);
  const tutorIdNumber = Number(tutorId);

  // ✅ CRITICAL: Validate tutor ID from JWT token - THIS IS THE SOURCE OF TRUTH
  let authenticatedTutorId = null;
  try {
    const token = req.cookies?.token || req.cookies?.authToken;
    console.log('[QUERY ACCEPT] 🔍 Checking authentication:', {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      cookies: Object.keys(req.cookies || {}),
      bodyTutorId: tutorIdNumber,
    });
    
    if (token) {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret-change-me");
      console.log('[QUERY ACCEPT] 🔍 JWT decoded:', {
        id: decoded.id,
        role: decoded.role,
        expectedRole: 'tutor',
        matches: decoded.role === 'tutor',
      });
      
      if (decoded.role === 'tutor') {
        authenticatedTutorId = Number(decoded.id);
        console.log('[QUERY ACCEPT] ✅ Authenticated tutor ID from JWT:', authenticatedTutorId);
      } else {
        console.warn('[QUERY ACCEPT] ⚠️ JWT role is not tutor:', {
          decodedRole: decoded.role,
          decodedId: decoded.id,
          bodyTutorId: tutorIdNumber,
          message: 'Cookie contains wrong user type. User must log out and log back in as tutor.',
        });
      }
    } else {
      console.warn('[QUERY ACCEPT] ⚠️ No JWT token found in cookies:', {
        cookies: Object.keys(req.cookies || {}),
        message: 'No authentication token found. User must log in.',
      });
    }
  } catch (e) {
    console.error('[QUERY ACCEPT] ❌ JWT verification failed:', {
      error: e.message,
      stack: e.stack,
      message: 'Token is invalid or expired. User must log in again.',
    });
    // JWT verification failed - this is a problem, but continue with body tutorId as fallback
  }

  // ✅ CRITICAL: ALWAYS use JWT tutor ID if available (it's the source of truth)
  // If JWT is not available, reject the request (security issue)
  if (!authenticatedTutorId) {
    console.error('[QUERY ACCEPT] 🚨 NO JWT TUTOR ID - Rejecting request for security');
    // Check if token exists but has wrong role
    const token = req.cookies?.token || req.cookies?.authToken;
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret-change-me");
        if (decoded.role === 'student') {
          return res.status(401).json({ 
            message: 'You are logged in as a student. Please log out and log back in as a tutor to accept queries.',
            code: 'WRONG_USER_TYPE'
          });
        }
      } catch (e) {
        // Token invalid, fall through to generic message
      }
    }
    return res.status(401).json({ 
      message: 'Authentication required. Please log out and log back in as a tutor.',
      code: 'AUTH_REQUIRED'
    });
  }

  const finalTutorId = authenticatedTutorId;

  if (authenticatedTutorId !== tutorIdNumber) {
    console.warn('[QUERY ACCEPT] 🚨 TUTOR ID MISMATCH - Using JWT ID instead of body ID:', {
      bodyTutorId: tutorIdNumber,
      jwtTutorId: authenticatedTutorId,
      action: 'Using JWT tutor ID (source of truth) for query acceptance'
    });
  }

  if (!Number.isInteger(queryIdNumber) || !Number.isInteger(finalTutorId)) {
    return res.status(400).json({ message: 'Invalid queryId or tutorId' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const queryResult = await client.query(
      `SELECT id, student_id, status
         FROM queries
        WHERE id = $1
        FOR UPDATE`,
      [queryIdNumber]
    );

    if (queryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Query not found' });
    }

    const queryRow = queryResult.rows[0];
    // Only allow acceptances for OPEN or PENDING_STUDENT_SELECTION queries
    // Reject if already ASSIGNED, CLOSED, or COMPLETED
    if (!['pending', 'OPEN', 'PENDING_STUDENT_SELECTION'].includes(queryRow.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Query is no longer available for acceptance' });
    }

    const tutorResult = await client.query(
      `SELECT id, user_type, username, bio, education, rate_per_10_min
         FROM users
        WHERE id = $1
        FOR UPDATE`,
      [finalTutorId]
    );

    if (tutorResult.rows.length === 0 || tutorResult.rows[0].user_type !== 'tutor') {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Tutor not found' });
    }

    const tutorRow = tutorResult.rows[0];
    
    // ✅ CRITICAL: Verify the tutor ID matches what we're about to insert
    if (tutorRow.id !== finalTutorId) {
      console.error('[QUERY ACCEPT] 🚨 CRITICAL MISMATCH - Tutor ID from DB does not match finalTutorId!', {
        tutorRowId: tutorRow.id,
        finalTutorId: finalTutorId,
        tutorUsername: tutorRow.username,
        action: 'ABORTING - This should never happen!'
      });
      await client.query('ROLLBACK');
      return res.status(500).json({ message: 'Internal error: Tutor ID mismatch' });
    }

    // Check if acceptance already exists
    const existingAcceptance = await client.query(
      `SELECT status FROM query_acceptances 
       WHERE query_id = $1 AND tutor_id = $2`,
      [queryIdNumber, finalTutorId]
    );

    if (existingAcceptance.rows.length > 0) {
      const currentStatus = existingAcceptance.rows[0].status;
      // If already PENDING or SELECTED, that's fine - tutor already accepted
      if (currentStatus === 'PENDING' || currentStatus === 'SELECTED') {
        // Already accepted, nothing to do
      } else if (currentStatus === 'REJECTED') {
        // Allow re-acceptance if previously rejected
        await client.query(
          `UPDATE query_acceptances 
           SET status = 'PENDING', accepted_at = CURRENT_TIMESTAMP
           WHERE query_id = $1 AND tutor_id = $2`,
          [queryIdNumber, finalTutorId]
        );
      }
    } else {
      // Insert new acceptance
      // ✅ CRITICAL: Log before INSERT to debug tutor ID issues
      console.log('[QUERY ACCEPT] 🔍 About to INSERT acceptance:', {
        queryId: queryIdNumber,
        finalTutorId: finalTutorId,
        bodyTutorId: tutorIdNumber,
        jwtTutorId: authenticatedTutorId,
        tutorUsername: tutorRow.username
      });
      
      await client.query(
        `INSERT INTO query_acceptances (query_id, tutor_id, status)
         VALUES ($1, $2, 'PENDING')`,
        [queryIdNumber, finalTutorId]
      );
      
      console.log('[QUERY ACCEPT] ✅ INSERTED acceptance successfully:', {
        queryId: queryIdNumber,
        tutorId: finalTutorId,
        tutorUsername: tutorRow.username
      });
    }

    // Update query status: if OPEN/pending, move to PENDING_STUDENT_SELECTION
    const newStatus = queryRow.status === 'pending' ? 'PENDING_STUDENT_SELECTION' : queryRow.status;
    await client.query(
      `UPDATE queries
          SET status = $2,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [queryIdNumber, newStatus]
    );

    await client.query(
      `DELETE FROM query_declines
        WHERE query_id = $1 AND tutor_id = $2`,
      [queryIdNumber, finalTutorId]
    );

    await client.query('COMMIT');

    console.log('[QUERY ACCEPT] ✅ Query accepted successfully:', {
      queryId: queryIdNumber,
      tutorId: finalTutorId,
      bodyTutorId: tutorIdNumber,
      jwtTutorId: authenticatedTutorId
    });

    if (io) {
      // Notify student that a tutor has accepted
      io.to(`student-${queryRow.student_id}`).emit('tutor-accepted-query', {
        queryId: queryIdNumber.toString(),
        tutorId: tutorIdNumber.toString(),
        tutorName: tutorRow.username,
        rate:
          tutorRow.rate_per_10_min !== null && tutorRow.rate_per_10_min !== undefined
            ? Number(tutorRow.rate_per_10_min)
            : null,
        bio: tutorRow.bio || '',
        education: tutorRow.education || '',
        message: `${tutorRow.username} has accepted your query.`
      });
    }

    res.json({ message: 'Query accepted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error accepting query:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// ------------------------
// POST /queries/decline
// ------------------------
router.post('/decline', async (req, res) => {
  const { queryId, tutorId } = req.body;

  const queryIdNumber = Number(queryId);
  const tutorIdNumber = Number(tutorId);

  if (!Number.isInteger(queryIdNumber) || !Number.isInteger(tutorIdNumber)) {
    return res.status(400).json({ message: 'Invalid queryId or tutorId' });
  }

  try {
    await pool.query(
      `INSERT INTO query_declines (query_id, tutor_id)
       VALUES ($1, $2)
       ON CONFLICT (query_id, tutor_id) DO UPDATE
           SET created_at = CURRENT_TIMESTAMP`,
      [queryIdNumber, tutorIdNumber]
    );

    res.json({ message: 'Query declined successfully' });
  } catch (error) {
    console.error('Error declining query:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ------------------------
// GET /queries/all
// ------------------------
router.get('/all', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT q.id, q.subject, q.subtopic, q.query_text, q.student_id, q.status, q.created_at,
              q.accepted_tutor_id, s.username AS student_name
         FROM queries q
         JOIN users s ON s.id = q.student_id
     ORDER BY q.created_at DESC`
    );

    const allQueries = result.rows.map((row) => mapQueryRow(row));
    res.json(allQueries);
  } catch (error) {
    console.error('Error fetching queries:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ------------------------
// POST /queries/session
// ------------------------
router.post('/session', async (req, res) => {
  const { queryId, tutorId, studentId } = req.body;

  // ✅ CRITICAL: Log the raw request body to debug tutor ID issues
  console.log('[SESSION CREATE] Raw request body:', {
    queryId,
    tutorId,
    studentId,
    bodyKeys: Object.keys(req.body),
    fullBody: req.body
  });

  const queryIdNumber = Number(queryId);
  const tutorIdNumber = Number(tutorId);
  const studentIdNumber = Number(studentId);

  // ✅ CRITICAL: Validate tutor ID from JWT token if available
  let authenticatedTutorId = null;
  try {
    const token = req.cookies?.token || req.cookies?.authToken;
    if (token) {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret-change-me");
      if (decoded.role === 'tutor') {
        authenticatedTutorId = Number(decoded.id);
        console.log('[SESSION CREATE] Authenticated tutor ID from JWT:', authenticatedTutorId);
      }
    }
  } catch (e) {
    // JWT verification failed, continue with body tutorId
  }

  // ✅ CRITICAL: If JWT tutor ID doesn't match body tutorId, use JWT ID (more secure)
  const finalTutorId = authenticatedTutorId && authenticatedTutorId !== tutorIdNumber 
    ? authenticatedTutorId 
    : tutorIdNumber;

  if (authenticatedTutorId && authenticatedTutorId !== tutorIdNumber) {
    console.warn('[SESSION CREATE] 🚨 TUTOR ID MISMATCH - Using JWT ID instead of body ID:', {
      bodyTutorId: tutorIdNumber,
      jwtTutorId: authenticatedTutorId,
      action: 'Using JWT tutor ID for session creation'
    });
  }

  if (
    !Number.isInteger(queryIdNumber) ||
    !Number.isInteger(finalTutorId) ||
    !Number.isInteger(studentIdNumber)
  ) {
    return res.status(400).json({ message: 'Invalid identifiers provided' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const queryResult = await client.query(
      'SELECT id, status FROM queries WHERE id = $1 FOR UPDATE',
      [queryIdNumber]
    );

    if (queryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Query not found' });
    }

    const existingSessionResult = await client.query(
      `SELECT id, status
         FROM sessions
        WHERE query_id = $1
     ORDER BY start_time DESC
        LIMIT 1`,
      [queryIdNumber]
    );

    if (existingSessionResult.rows.length > 0) {
      const existingSession = existingSessionResult.rows[0];
      if (existingSession.status !== 'ended') {
        await client.query('COMMIT');
        return res.status(200).json({
          message: 'Session already active',
          sessionId: existingSession.id.toString()
        });
      }
    }

    const sessionResult = await client.query(
      `INSERT INTO sessions (query_id, tutor_id, student_id)
       VALUES ($1, $2, $3)
    RETURNING id, start_time`,
      [queryIdNumber, finalTutorId, studentIdNumber]
    );

    await client.query(
      `UPDATE queries
          SET status = 'in-session',
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [queryIdNumber]
    );

    await client.query('COMMIT');

    console.log('[SESSION CREATE] ✅ Session created successfully:', {
      queryId: queryIdNumber,
      tutorId: finalTutorId,
      studentId: studentIdNumber,
      bodyTutorId: tutorIdNumber,
      jwtTutorId: authenticatedTutorId,
      sessionId: sessionResult.rows[0].id
    });

    // Emit real-time events to notify both tutor and student
    if (io) {
      // Notify tutor that session is ready - use finalTutorId
      io.to(`tutor-${finalTutorId}`).emit('session-created', {
        queryId: queryIdNumber.toString(),
        sessionId: sessionResult.rows[0].id.toString(),
        message: 'Session created successfully. You can now enter the session.'
      });

      // Notify student that session is ready - use finalTutorId
      io.to(`student-${studentIdNumber}`).emit('session-ready', {
        queryId: queryIdNumber.toString(),
        sessionId: sessionResult.rows[0].id.toString(),
        tutorId: finalTutorId.toString(),
        message: 'Tutor has started the session. You can now enter.'
      });
    }

    res.status(201).json({
      message: 'Session created successfully',
      sessionId: sessionResult.rows[0].id.toString()
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating session:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// ------------------------
// POST /queries/session/:sessionId/charge-on-enter
// TOKENS V2 - Charge tokens when student clicks "Enter Session"
// This is the ONLY place where tokens are charged on session entry
// ------------------------
router.post('/session/:sessionId/charge-on-enter', async (req, res) => {
  const sessionIdNumber = Number(req.params.sessionId);

  if (!Number.isInteger(sessionIdNumber)) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_SESSION_ID',
      message: 'Invalid sessionId',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check which column exists (tokens_charged or tokens_transferred)
    const colCheck = await client.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'sessions' 
       AND column_name IN ('tokens_charged', 'tokens_transferred')
       ORDER BY CASE WHEN column_name = 'tokens_charged' THEN 1 ELSE 2 END
       LIMIT 1`
    );
    const chargeColumn = colCheck.rows[0]?.column_name || 'tokens_transferred';

    // 1) Load session + tutor rate + student id, and lock the session row
    const queryText = `
      SELECT 
        s.id,
        s.student_id,
        s.tutor_id,
        s.${chargeColumn} AS tokens_charged,
        u_t.rate_per_10_min AS rate
      FROM sessions s
      JOIN users u_t ON u_t.id = s.tutor_id
      WHERE s.id = $1
      FOR UPDATE
    `;
    const { rows: sessionRows } = await client.query(queryText, [sessionIdNumber]);

    if (sessionRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        ok: false,
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      });
    }

    const session = sessionRows[0];
    
    // Convert rate to integer tokens (1 token = $1)
    // Round to nearest integer since tokens must be whole numbers
    const rate =
      session.rate !== null && session.rate !== undefined
        ? Math.round(Number(session.rate))
        : 0;

    const tokensCharged = session.tokens_charged === true || session.tokens_charged === 't' || session.tokens_charged === 1;

    console.log('[🪙 COINS ENTER] charge-on-enter called', {
      sessionId: sessionIdNumber,
      studentId: session.student_id,
      tutorId: session.tutor_id,
      coins_already_charged: tokensCharged,
      tutorRatePerMin: session.rate,
      coinsToCharge: rate,
    });

    // 2) If tokens already charged for this session, just return success
    if (tokensCharged) {
      await client.query('COMMIT');
      return res.json({
        ok: true,
        alreadyCharged: true,
        studentId: session.student_id,
        tutorId: session.tutor_id,
      });
    }

    // 3) Free session (rate <= 0) → mark as charged but no balance change
    if (!rate || rate <= 0) {
      await client.query(
        `UPDATE sessions SET ${chargeColumn} = TRUE WHERE id = $1`,
        [sessionIdNumber]
      );
      await client.query('COMMIT');
      return res.json({
        ok: true,
        alreadyCharged: false,
        studentTokens: null,
        tutorTokens: null,
        rate,
      });
    }

    // 4) Lock student + tutor rows
    const { rows: studentRows } = await client.query(
      `SELECT id, tokens FROM users WHERE id = $1 FOR UPDATE`,
      [session.student_id]
    );

    const { rows: tutorRows } = await client.query(
      `SELECT id, tokens FROM users WHERE id = $1 FOR UPDATE`,
      [session.tutor_id]
    );

    if (studentRows.length === 0 || tutorRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        ok: false,
        code: 'USER_NOT_FOUND',
        message: 'Student or tutor not found for this session',
      });
    }

    const studentOld = Number(studentRows[0].tokens ?? 0);
    const tutorOld = Number(tutorRows[0].tokens ?? 0);

    console.log('[🪙 COINS ENTER] BEFORE transfer', {
      studentId: session.student_id,
      tutorId: session.tutor_id,
      studentCoinsBefore: studentOld,
      tutorCoinsBefore: tutorOld,
      coinsToTransfer: rate,
    });

    // 5) Check student has enough coins (1 coin = $1)
    if (studentOld < rate) {
      await client.query('ROLLBACK');
      console.log('[🪙 COINS ENTER] INSUFFICIENT_COINS', {
        studentHas: studentOld,
        sessionRequires: rate,
        deficit: rate - studentOld,
      });
      return res.status(400).json({
        ok: false,
        code: 'INSUFFICIENT_TOKENS',
        message: `Not enough coins. You have ${studentOld} coins but need ${rate} coins ($${rate}) to enter this session.`,
        studentTokens: studentOld,
        required: rate,
      });
    }

    // 6) Compute new balances - EXACT deduction (1 coin = $1)
    // Student pays exactly the tutor's rate_per_10_min (rounded to whole coins)
    // Tutor receives exactly the same amount
    const studentNew = studentOld - rate;
    const tutorNew = tutorOld + rate;

    console.log('[🪙 COINS ENTER] CALCULATED new balances', {
      calculation: `${studentOld} - ${rate} = ${studentNew} (student)`,
      tutorCalculation: `${tutorOld} + ${rate} = ${tutorNew} (tutor)`,
    });

    // 7) Update users - PERSIST both student and tutor tokens to DB
    await client.query(
      `UPDATE users SET tokens = $1 WHERE id = $2`,
      [studentNew, session.student_id]
    );

    // ✅ STEP 2: Ensure tutor tokens are persisted to DB
    await client.query(
      `UPDATE users SET tokens = $1 WHERE id = $2`,
      [tutorNew, session.tutor_id]
    );
    
    console.log('[🪙 COINS ENTER] Updating tokens in DB for tutor', session.tutor_id, '=>', tutorNew);

    // 8) Mark session as charged (do NOT change video/timer status here)
    await client.query(
      `UPDATE sessions SET ${chargeColumn} = TRUE WHERE id = $1`,
      [sessionIdNumber]
    );

    await client.query('COMMIT');

    console.log('[🪙 COINS ENTER] ✅ TRANSFER COMPLETED AND SAVED TO DB', {
      sessionId: sessionIdNumber,
      studentId: session.student_id,
      tutorId: session.tutor_id,
      coinsTransferred: rate,
      studentBalance: `${studentOld} 🪙 → ${studentNew} 🪙 (paid ${rate} coins)`,
      tutorBalance: `${tutorOld} 🪙 → ${tutorNew} 🪙 (earned ${rate} coins)`,
      equivalentUSD: `$${rate}`,
    });

    // 🔥 EMIT SOCKET EVENT to notify tutor of coin earning - IMMEDIATELY after commit
    // Use setImmediate to ensure DB transaction is fully committed before emitting
    if (io) {
      setImmediate(() => {
        const tutorRoom = `tutor-${session.tutor_id}`;
        const eventData = {
          userId: session.tutor_id,
          sessionId: sessionIdNumber,
          newBalance: tutorNew,
          earned: rate,
          reason: 'session-started',
        };
        
        // Emit to tutor room (primary method)
        io.to(tutorRoom).emit('coins-updated', eventData);
        
        // Also emit directly to any socket with this tutor ID (fallback)
        io.sockets.sockets.forEach((socket) => {
          if (socket.data && socket.data.tutorId === session.tutor_id) {
            socket.emit('coins-updated', eventData);
          }
        });
        
        // Log socket room status for debugging
        io.in(tutorRoom).fetchSockets().then((sockets) => {
          console.log('[🪙 COINS] 📢 Socket event sent to tutor:', {
            tutorId: session.tutor_id,
            room: tutorRoom,
            socketsInRoom: sockets.length,
            socketIds: sockets.map(s => s.id),
            newBalance: tutorNew,
            earned: rate,
          });
        }).catch((err) => {
          console.log('[🪙 COINS] 📢 Socket event sent to tutor (room check failed):', {
            tutorId: session.tutor_id,
            room: tutorRoom,
            newBalance: tutorNew,
            earned: rate,
            error: err.message,
          });
        });
      });
    }

    // Return success - coins are now in DB, frontend will fetch them via separate GET endpoints
    return res.json({
      ok: true,
      alreadyCharged: false,
      rate,
      message: `Charged ${rate} coins ($${rate}) for this session`,
      studentId: session.student_id,
      tutorId: session.tutor_id,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[TOKENS ENTER] ERROR', err);
    return res.status(500).json({
      ok: false,
      code: 'SERVER_ERROR',
      message: err.message || 'Failed to charge tokens on enter',
    });
  } finally {
    client.release();
  }
});

// ------------------------
// GET /queries/session/:sessionId/user/:userId/coins
// Get coin balance for a specific user in a session
// (Bypasses cookie auth for multi-tab scenarios)
// ------------------------
router.get('/session/:sessionId/user/:userId/coins', async (req, res) => {
  const requestStartTime = Date.now();
  const sessionIdNumber = Number(req.params.sessionId);
  const userIdNumber = Number(req.params.userId);

  console.log(`[🪙 COINS GET] Request received at ${requestStartTime}ms: sessionId=${sessionIdNumber}, userId=${userIdNumber}`);

  if (!Number.isInteger(sessionIdNumber) || !Number.isInteger(userIdNumber)) {
    return res.status(400).json({
      ok: false,
      message: 'Invalid sessionId or userId',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ✅ STEP 2: Load session with charge status and tutor rate
    const colCheck = await client.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'sessions' 
       AND column_name IN ('tokens_charged', 'tokens_transferred')
       ORDER BY CASE WHEN column_name = 'tokens_charged' THEN 1 ELSE 2 END
       LIMIT 1`
    );
    const chargeColumn = colCheck.rows[0]?.column_name || 'tokens_transferred';

    const { rows: sessionRows } = await client.query(
      `SELECT 
        s.id,
        s.student_id,
        s.tutor_id,
        s.${chargeColumn} AS tokens_charged,
        u_t.rate_per_10_min AS rate
       FROM sessions s
       JOIN users u_t ON u_t.id = s.tutor_id
       WHERE s.id = $1
       FOR UPDATE`,
      [sessionIdNumber]
    );

    if (sessionRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        ok: false,
        message: 'Session not found',
      });
    }

    const session = sessionRows[0];
    const paramUserId = userIdNumber;
    const isStudent = paramUserId === session.student_id;
    const isTutor = paramUserId === session.tutor_id;

    if (!isStudent && !isTutor) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        ok: false,
        message: 'User is not part of this session',
      });
    }

    // ✅ STEP 2: If called by student, handle charge (deduct student, credit tutor)
    if (isStudent) {
      const tokensCharged = session.tokens_charged === true || session.tokens_charged === 't' || session.tokens_charged === 1;
      const rate = session.rate !== null && session.rate !== undefined ? Math.round(Number(session.rate)) : 0;

      console.log('[🪙 COINS GET] Student endpoint called - checking if charge needed:', {
        sessionId: sessionIdNumber,
        studentId: session.student_id,
        tutorId: session.tutor_id,
        tokensCharged,
        rate,
      });

      // If already charged, just return current coins
      if (tokensCharged) {
        const { rows: studentRows } = await client.query(
          `SELECT id, user_type, tokens FROM users WHERE id = $1`,
          [session.student_id]
        );
        await client.query('COMMIT');
        client.release();

        if (studentRows.length === 0) {
          return res.status(404).json({
            ok: false,
            message: 'Student not found',
          });
        }

        const student = studentRows[0];
        const coins = Number(student.tokens ?? 0);

        console.log('[🪙 COINS GET] Already charged, returning current student coins:', {
          studentId: session.student_id,
          coins,
        });

        return res.json({
          ok: true,
          userId: student.id,
          userType: student.user_type,
          coins,
        });
      }

      // Free session (rate <= 0) → mark as charged but no balance change
      if (!rate || rate <= 0) {
        const { rows: studentRows } = await client.query(
          `SELECT id, user_type, tokens FROM users WHERE id = $1`,
          [session.student_id]
        );
        
        await client.query(
          `UPDATE sessions SET ${chargeColumn} = TRUE WHERE id = $1`,
          [sessionIdNumber]
        );
        await client.query('COMMIT');
        client.release();

        if (studentRows.length === 0) {
          return res.status(404).json({
            ok: false,
            message: 'Student not found',
          });
        }

        const student = studentRows[0];
        const coins = Number(student.tokens ?? 0);

        return res.json({
          ok: true,
          userId: student.id,
          userType: student.user_type,
          coins,
        });
      }

      // ✅ STEP 2: Charge coins - deduct from student, credit to tutor
      // Lock both user rows
      const { rows: studentRows } = await client.query(
        `SELECT id, tokens FROM users WHERE id = $1 FOR UPDATE`,
        [session.student_id]
      );

      const { rows: tutorRows } = await client.query(
        `SELECT id, tokens FROM users WHERE id = $1 FOR UPDATE`,
        [session.tutor_id]
      );

      if (studentRows.length === 0 || tutorRows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(500).json({
          ok: false,
          message: 'Student or tutor not found',
        });
      }

      const studentOld = Number(studentRows[0].tokens ?? 0);
      const tutorOld = Number(tutorRows[0].tokens ?? 0);

      // Check student has enough coins
      if (studentOld < rate) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({
          ok: false,
          code: 'INSUFFICIENT_TOKENS',
          message: `Not enough coins. You have ${studentOld} coins but need ${rate} coins ($${rate}) to enter this session.`,
          studentTokens: studentOld,
          required: rate,
        });
      }

      // Compute new balances
      const studentNew = studentOld - rate;
      const tutorNew = tutorOld + rate;

      console.log('[🪙 COINS GET] Charging coins:', {
        studentId: session.student_id,
        tutorId: session.tutor_id,
        studentOld,
        studentNew,
        tutorOld,
        tutorNew,
        rate,
      });

      // ✅ STEP 2: Update both users in DB
      await client.query(
        `UPDATE users SET tokens = $1 WHERE id = $2`,
        [studentNew, session.student_id]
      );

      await client.query(
        `UPDATE users SET tokens = $1 WHERE id = $2`,
        [tutorNew, session.tutor_id]
      );

      console.log('[🪙 COINS GET] Updating tokens in DB for tutor', session.tutor_id, '=>', tutorNew);

      // Mark session as charged
      await client.query(
        `UPDATE sessions SET ${chargeColumn} = TRUE WHERE id = $1`,
        [sessionIdNumber]
      );

      await client.query('COMMIT');
      client.release();

      console.log('[🪙 COINS GET] ✅ Charge completed and saved to DB:', {
        sessionId: sessionIdNumber,
        studentId: session.student_id,
        tutorId: session.tutor_id,
        studentBalance: `${studentOld} 🪙 → ${studentNew} 🪙`,
        tutorBalance: `${tutorOld} 🪙 → ${tutorNew} 🪙`,
        rate,
      });

      // Return student coins (tutor coins will be picked up via /api/me polling)
      return res.json({
        ok: true,
        userId: session.student_id,
        userType: 'student',
        coins: studentNew,
        tutorId: session.tutor_id,
        tutorCoins: tutorNew, // Optional: include in response
      });
    }

    // ✅ STEP 2: If called by tutor, just return current coins (read-only)
    if (isTutor) {
      const { rows: tutorRows } = await client.query(
        `SELECT id, user_type, tokens FROM users WHERE id = $1`,
        [session.tutor_id]
      );
      await client.query('COMMIT');
      client.release();

      if (tutorRows.length === 0) {
        return res.status(404).json({
          ok: false,
          message: 'Tutor not found',
        });
      }

      const tutor = tutorRows[0];
      const coins = Number(tutor.tokens ?? 0);

      console.log('[🪙 COINS GET] Tutor read-only request - returning current coins:', {
        tutorId: session.tutor_id,
        coins,
      });

      return res.json({
        ok: true,
        userId: tutor.id,
        userType: tutor.user_type,
        coins,
      });
    }

    // Should not reach here
    await client.query('ROLLBACK');
    client.release();
    return res.status(500).json({
      ok: false,
      message: 'Unexpected error',
    });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
    console.error('[🪙 COINS GET] ERROR', err);
    return res.status(500).json({
      ok: false,
      message: 'Failed to get coins',
    });
  }
});

// ------------------------
// POST /queries/session/:sessionId/start
// Timer start only - NO token logic here (tokens charged on student enter)
// ------------------------
router.post('/session/:sessionId/start', async (req, res) => {
  const sessionIdNumber = Number(req.params.sessionId);

  if (!Number.isInteger(sessionIdNumber)) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_SESSION_ID',
      message: 'Invalid sessionId',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Check session exists
    const { rows: sessionRows } = await client.query(
      `SELECT id, status FROM sessions WHERE id = $1 FOR UPDATE`,
      [sessionIdNumber]
    );

    if (sessionRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        ok: false,
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      });
    }

    // 2) Mark session as started (for timer purposes only)
    await client.query(
      `UPDATE sessions SET status = 'started' WHERE id = $1`,
      [sessionIdNumber]
    );

    await client.query('COMMIT');

    return res.json({
      ok: true,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[ERROR] start-session', error);
    return res.status(500).json({
      ok: false,
      code: 'SERVER_ERROR',
      message: error.message || 'Failed to start session',
    });
  } finally {
    client.release();
  }
});

// ------------------------
// POST /queries/session/end
// ------------------------
router.post('/session/end', async (req, res) => {
  const { sessionId, endedBy } = req.body;

  const sessionIdNumber = Number(sessionId);
  const endedByNumber = Number(endedBy);

  if (!Number.isInteger(sessionIdNumber) || !Number.isInteger(endedByNumber)) {
    return res.status(400).json({ message: 'Invalid sessionId or endedBy' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const sessionResult = await client.query(
      `SELECT id, query_id, status, student_id, tutor_id
         FROM sessions
        WHERE id = $1
        FOR UPDATE`,
      [sessionIdNumber]
    );

    if (sessionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Session not found' });
    }

    const sessionRow = sessionResult.rows[0];

    const queryInfoResult = await client.query(
      `SELECT id, student_id, accepted_tutor_id
         FROM queries
        WHERE id = $1`,
      [sessionRow.query_id]
    );

    const queryInfo = queryInfoResult.rows[0] || null;

    if (sessionRow.status === 'ended') {
      await client.query('ROLLBACK');
      return res.json({ message: 'Session already ended' });
    }

    // ✅ CRITICAL: Get studentId and tutorId BEFORE any deletion
    const studentId = sessionRow.student_id;
    const tutorId = sessionRow.tutor_id;

    await client.query(
      `UPDATE sessions SET status = 'ended' WHERE id = $1`,
      [sessionIdNumber]
    );

    // ✅ CRITICAL: DO NOT delete query here - delete it AFTER rating is submitted
    // This ensures:
    // 1. Rating page can load (needs session which needs query)
    // 2. Coin updates can work (needs session to get participants)
    // Query will be deleted in the rating endpoint after rating is submitted

    await client.query('COMMIT');

    if (io) {
      const payload = {
        sessionId: sessionIdNumber.toString(),
        endedBy: endedByNumber.toString(),
        queryId: sessionRow.query_id ? sessionRow.query_id.toString() : null,
        tutorId: tutorId ? tutorId.toString() : (queryInfo?.accepted_tutor_id ? queryInfo.accepted_tutor_id.toString() : null),
        studentId: studentId ? studentId.toString() : (queryInfo?.student_id ? queryInfo.student_id.toString() : null)
      };

      io.to(`session-${sessionIdNumber}`).emit('session-ended', payload);

      if (queryInfo?.accepted_tutor_id) {
        io.to(`tutor-${queryInfo.accepted_tutor_id}`).emit('session-ended', payload);
      }

      if (queryInfo?.student_id) {
        io.to(`student-${queryInfo.student_id}`).emit('session-ended', payload);
      }
    }

    res.json({ message: 'Session ended successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error ending session:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// ------------------------
// GET /queries/session/:sessionId/summary
// ------------------------
// ------------------------
// GET /queries/session/:sessionId/participants
// Get student and tutor IDs for a session (for coin sync)
// ------------------------
router.get('/session/:sessionId/participants', async (req, res) => {
  const sessionIdNumber = Number(req.params.sessionId);

  if (!Number.isInteger(sessionIdNumber)) {
    return res.status(400).json({ ok: false, message: 'Invalid sessionId' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT student_id, tutor_id FROM sessions WHERE id = $1`,
      [sessionIdNumber]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Session not found' });
    }

    return res.json({
      ok: true,
      studentId: rows[0].student_id,
      tutorId: rows[0].tutor_id,
    });
  } catch (err) {
    console.error('[SESSION PARTICIPANTS] ERROR', err);
    return res.status(500).json({ ok: false, message: 'Failed to get session participants' });
  }
});

router.get('/session/:sessionId/summary', async (req, res) => {
  const sessionIdNumber = Number(req.params.sessionId);
  const studentIdNumber = Number(req.query.studentId);

  if (!Number.isInteger(sessionIdNumber) || !Number.isInteger(studentIdNumber)) {
    return res.status(400).json({ message: 'Invalid sessionId or studentId' });
  }

  try {
    // Query should still exist since we only delete it AFTER rating is submitted
    const { rows } = await pool.query(
      `SELECT s.id,
              s.status,
              s.rating,
              s.student_id,
              s.tutor_id,
              q.subject,
              q.subtopic,
              q.query_text,
              u.username AS tutor_name,
              u.rate_per_10_min
         FROM sessions s
         JOIN queries q ON q.id = s.query_id
         JOIN users u ON u.id = s.tutor_id
        WHERE s.id = $1`,
      [sessionIdNumber]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const row = rows[0];
    if (row.student_id !== studentIdNumber) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    res.json({
      sessionId: row.id.toString(),
      status: row.status,
      rating: row.rating,
      studentId: row.student_id,
      tutorId: row.tutor_id,
      tutorName: row.tutor_name,
      subject: row.subject,
      subtopic: row.subtopic,
      query: row.query_text,
      ratePer10Min:
        row.rate_per_10_min !== null && row.rate_per_10_min !== undefined
          ? Number(row.rate_per_10_min)
          : null
    });
  } catch (error) {
    console.error('Error fetching session summary:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ------------------------
// POST /queries/session/:sessionId/rate
// ------------------------
router.post('/session/:sessionId/rate', async (req, res) => {
  const sessionIdNumber = Number(req.params.sessionId);
  const studentIdNumber = Number(req.body.studentId);
  const ratingNumber = Number(req.body.rating);

  if (!Number.isInteger(sessionIdNumber) || !Number.isInteger(studentIdNumber)) {
    return res.status(400).json({ message: 'Invalid sessionId or studentId' });
  }

  if (!Number.isInteger(ratingNumber) || ratingNumber < 1 || ratingNumber > 5) {
    return res.status(400).json({ message: 'Rating must be an integer between 1 and 5' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const sessionResult = await client.query(
      `SELECT s.id,
              s.student_id,
              s.tutor_id,
              s.status,
              s.rating
         FROM sessions s
        WHERE s.id = $1
        FOR UPDATE`,
      [sessionIdNumber]
    );

    if (sessionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Session not found' });
    }

    const sessionRow = sessionResult.rows[0];
    if (sessionRow.student_id !== studentIdNumber) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (sessionRow.status !== 'ended') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Session must be ended before rating' });
    }

    // Update session rating
    await client.query(
      `UPDATE sessions
          SET rating = $1
        WHERE id = $2`,
      [ratingNumber, sessionIdNumber]
    );

    // ✅ Calculate and update tutor's average rating in database using incremental update
    // Formula: newAvg = (oldAvg * oldCount + newRating) / newCount
    const tutorId = sessionRow.tutor_id;
    if (tutorId) {
      // Fetch current tutor rating data
      const tutorResult = await client.query(
        `SELECT average_rating, review_count
           FROM users
          WHERE id = $1`,
        [tutorId]
      );

      if (tutorResult.rows.length === 0) {
        console.error('Tutor not found for rating update:', tutorId);
      } else {
        const tutorRow = tutorResult.rows[0];
        const oldAvg = tutorRow.average_rating ? Number(tutorRow.average_rating) : 0;
        const oldCount = tutorRow.review_count ? Number(tutorRow.review_count) : 0;
        const newCount = oldCount + 1;
        const newAvg = (oldAvg * oldCount + ratingNumber) / newCount;

        // ✅ CRITICAL: Save average rating and review count to users table in database
        await client.query(
          `UPDATE users 
              SET average_rating = $1,
                  review_count = $2,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = $3`,
          [newAvg, newCount, tutorId]
        );
        console.log('Tutor average rating and review count updated incrementally:', {
          tutorId,
          newRating: ratingNumber,
          oldAvg: oldAvg.toFixed(2),
          oldCount,
          newAvg: newAvg.toFixed(2),
          newCount
        });
      }
    }

    // ✅ CRITICAL: Delete the query AFTER rating is submitted
    // This ensures rating page and coin updates work before deletion
    const queryIdResult = await client.query(
      `SELECT query_id FROM sessions WHERE id = $1`,
      [sessionIdNumber]
    );
    
    if (queryIdResult.rows.length > 0 && queryIdResult.rows[0].query_id) {
      const queryId = queryIdResult.rows[0].query_id;
      await client.query(
        `DELETE FROM queries WHERE id = $1`,
        [queryId]
      );
      console.log('Query deleted after rating submission:', { queryId, sessionId: sessionIdNumber });
    }

    await client.query('COMMIT');
    console.log('Session rated:', { sessionId: sessionIdNumber, studentId: studentIdNumber, rating: ratingNumber });
    res.json({ message: 'Rating submitted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error rating session:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// ------------------------
// GET /queries/student/:studentId/responses
// ------------------------
router.get('/student/:studentId/responses', async (req, res) => {
  const studentId = Number(req.params.studentId);

  if (!Number.isInteger(studentId)) {
    return res.status(400).json({ message: 'Invalid studentId' });
  }

  try {
    // Get all tutors who accepted queries for this student
    // ✅ Filter out queries where session has ended (session_status = 'ended')
    console.log(`[STUDENT RESPONSES] Fetching responses for studentId: ${studentId}`);
    const result = await pool.query(
      `SELECT q.id AS query_id,
              q.subject,
              q.subtopic,
              q.query_text,
              q.status,
              q.accepted_tutor_id AS student_selected_tutor_id,
              q.created_at,
              q.updated_at,
              t.id AS tutor_id,
              t.username AS tutor_name,
              t.bio AS tutor_bio,
              t.education AS tutor_education,
              t.rate_per_10_min,
              t.average_rating AS tutor_avg_rating,
              t.review_count AS tutor_ratings_count,
              qa.accepted_at AS tutor_accepted_at,
              qa.status AS acceptance_status,
              s.id AS session_id,
              s.status AS session_status
         FROM queries q
         JOIN query_acceptances qa ON qa.query_id = q.id
         JOIN users t ON t.id = qa.tutor_id
    LEFT JOIN LATERAL (
           SELECT id, status
             FROM sessions
            WHERE query_id = q.id
         ORDER BY start_time DESC
            LIMIT 1
    ) s ON TRUE
        WHERE q.student_id = $1
          AND (s.status IS NULL OR s.status != 'ended')
          AND qa.status IN ('PENDING', 'SELECTED')
          AND (
            -- If student has selected a tutor (accepted_tutor_id is set), only show that tutor
            (q.accepted_tutor_id IS NOT NULL AND qa.tutor_id = q.accepted_tutor_id)
            OR
            -- If no tutor selected yet, show all PENDING/SELECTED tutors
            (q.accepted_tutor_id IS NULL)
          )
     ORDER BY q.id DESC, 
              CASE WHEN qa.status = 'SELECTED' THEN 0 ELSE 1 END,
              CASE WHEN qa.tutor_id = q.accepted_tutor_id THEN 0 ELSE 1 END,
              qa.accepted_at DESC`,
      [studentId]
    );

    // Group by query_id to show all tutors per query
    const responsesByQuery = {};
    result.rows.forEach((row) => {
      const queryId = row.query_id.toString();
      if (!responsesByQuery[queryId]) {
        responsesByQuery[queryId] = {
          queryId,
          subject: row.subject,
          subtopic: row.subtopic,
          query: row.query_text,
          status: row.status,
          studentSelectedTutorId: row.student_selected_tutor_id ? row.student_selected_tutor_id.toString() : null,
          tutors: [],
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
      }
      
      // ✅ Calculate average rating: (sum of all ratings) / (number of ratings)
      // If avg_rating is null, it means no ratings yet
      const avgRating = row.tutor_avg_rating !== null && row.tutor_avg_rating !== undefined
        ? Number(parseFloat(row.tutor_avg_rating).toFixed(2))
        : null;
      const ratingsCount = row.tutor_ratings_count ? Number(row.tutor_ratings_count) : 0;
      
      responsesByQuery[queryId].tutors.push({
        tutorId: row.tutor_id,
        tutorName: row.tutor_name,
        rate:
          row.rate_per_10_min !== null && row.rate_per_10_min !== undefined
            ? Number(row.rate_per_10_min)
            : null,
        bio: row.tutor_bio || '',
        education: row.tutor_education || '',
        tutorAcceptedAt: row.tutor_accepted_at,
        sessionId: row.session_id ? row.session_id.toString() : null,
        sessionStatus: row.session_status || null,
        tutorAverageRating: avgRating,
        tutorRatingsCount: ratingsCount,
        acceptanceStatus: row.acceptance_status || 'PENDING',
        isSelected: row.acceptance_status === 'SELECTED' || row.student_selected_tutor_id === row.tutor_id
      });
    });

    // Convert to array format
    const responses = Object.values(responsesByQuery);

    console.log(`[STUDENT RESPONSES] Returning ${responses.length} queries with tutors for studentId: ${studentId}`);
    res.json(responses);
  } catch (error) {
    console.error('Error fetching student responses:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// ------------------------
// POST /queries/student/select-tutor
// ------------------------
router.post('/student/select-tutor', async (req, res) => {
  const { queryId, tutorId, studentId } = req.body;

  const queryIdNumber = Number(queryId);
  const tutorIdNumber = Number(tutorId);
  const studentIdNumber = Number(studentId);

  if (!Number.isInteger(queryIdNumber) || !Number.isInteger(tutorIdNumber) || !Number.isInteger(studentIdNumber)) {
    return res.status(400).json({ message: 'Invalid queryId, tutorId, or studentId' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify query belongs to student
    const queryResult = await client.query(
      `SELECT id, student_id, status, subject, subtopic
         FROM queries
        WHERE id = $1 AND student_id = $2
        FOR UPDATE`,
      [queryIdNumber, studentIdNumber]
    );

    if (queryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Query not found or does not belong to student' });
    }

    const queryRow = queryResult.rows[0];

    // Verify query is in correct state for selection
    if (!['pending', 'OPEN', 'PENDING_STUDENT_SELECTION'].includes(queryRow.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Query is not in a state that allows tutor selection' });
    }

    // Verify tutor accepted this query with PENDING status
    const acceptanceResult = await client.query(
      `SELECT tutor_id, status FROM query_acceptances
        WHERE query_id = $1 AND tutor_id = $2 AND status = 'PENDING'`,
      [queryIdNumber, tutorIdNumber]
    );

    if (acceptanceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Tutor has not accepted this query or is not available for selection' });
    }

    // Get tutor info
    const tutorResult = await client.query(
      `SELECT id, username, bio, education, rate_per_10_min
         FROM users
        WHERE id = $1 AND user_type = 'tutor'`,
      [tutorIdNumber]
    );

    if (tutorResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Tutor not found' });
    }

    const tutorRow = tutorResult.rows[0];

    // Update query with selected tutor - set status to ASSIGNED
    await client.query(
      `UPDATE queries
          SET accepted_tutor_id = $2,
              status = 'ASSIGNED',
              accepted_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [queryIdNumber, tutorIdNumber]
    );

    // Mark selected tutor's acceptance as SELECTED
    await client.query(
      `UPDATE query_acceptances
          SET status = 'SELECTED'
        WHERE query_id = $1 AND tutor_id = $2`,
      [queryIdNumber, tutorIdNumber]
    );

    // Expire all other tutor acceptances for this query (set status to EXPIRED)
    await client.query(
      `UPDATE query_acceptances
          SET status = 'EXPIRED'
        WHERE query_id = $1 AND tutor_id != $2 AND status = 'PENDING'`,
      [queryIdNumber, tutorIdNumber]
    );

    // Get all expired tutor IDs for notifications
    const expiredTutorsResult = await client.query(
      `SELECT tutor_id FROM query_acceptances
        WHERE query_id = $1 AND status = 'EXPIRED' AND tutor_id != $2`,
      [queryIdNumber, tutorIdNumber]
    );
    const expiredTutorIds = expiredTutorsResult.rows.map(row => row.tutor_id);

    await client.query('COMMIT');

    console.log('Student selected tutor:', { queryId: queryIdNumber, tutorId: tutorIdNumber, studentId: studentIdNumber });

    // Emit real-time events via socket
    if (io) {
      // Notify selected tutor - they can now start session
      io.to(`tutor-${tutorIdNumber}`).emit('query-assigned', {
        queryId: queryIdNumber.toString(),
        studentId: studentIdNumber.toString(),
        message: 'Student has selected you for this query. You can now start the session.',
        querySubject: queryRow.subject || '',
        querySubtopic: queryRow.subtopic || ''
      });

      // Notify expired tutors - their acceptance has expired
      expiredTutorIds.forEach(expiredTutorId => {
        io.to(`tutor-${expiredTutorId}`).emit('query-expired', {
          queryId: queryIdNumber.toString(),
          message: 'This query has expired. Another tutor was selected.',
          querySubject: queryRow.subject || '',
          querySubtopic: queryRow.subtopic || ''
        });
      });

      // Notify student - tutor confirmed
      io.to(`student-${studentIdNumber}`).emit('tutor-confirmed', {
        queryId: queryIdNumber.toString(),
        tutorId: tutorIdNumber.toString(),
        tutorName: tutorRow.username,
        message: `${tutorRow.username} has been confirmed. Session ready to start.`
      });
    }

    res.json({ 
      message: 'Tutor selected successfully',
      tutor: {
        id: tutorRow.id,
        name: tutorRow.username,
        rate: tutorRow.rate_per_10_min ? Number(tutorRow.rate_per_10_min) : null,
        bio: tutorRow.bio,
        education: tutorRow.education
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[SELECT TUTOR] ERROR:', error);
    console.error('[SELECT TUTOR] Error details:', {
      message: error.message,
      stack: error.stack,
      queryId: queryIdNumber,
      tutorId: tutorIdNumber,
      studentId: studentIdNumber
    });
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// ------------------------
// POST /queries/tutor/dismiss-expired
// Dismiss an expired query from tutor dashboard
// ------------------------
router.post('/tutor/dismiss-expired', async (req, res) => {
  const { queryId, tutorId } = req.body;

  const queryIdNumber = Number(queryId);
  const tutorIdNumber = Number(tutorId);

  if (!Number.isInteger(queryIdNumber) || !Number.isInteger(tutorIdNumber)) {
    return res.status(400).json({ ok: false, message: 'Invalid queryId or tutorId' });
  }

  try {
    // Verify this tutor has an EXPIRED acceptance for this query
    const acceptanceResult = await pool.query(
      `SELECT status FROM query_acceptances
        WHERE query_id = $1 AND tutor_id = $2 AND status = 'EXPIRED'`,
      [queryIdNumber, tutorIdNumber]
    );

    if (acceptanceResult.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Expired acceptance not found' });
    }

    // Delete the expired acceptance (dismiss it)
    await pool.query(
      `DELETE FROM query_acceptances
        WHERE query_id = $1 AND tutor_id = $2 AND status = 'EXPIRED'`,
      [queryIdNumber, tutorIdNumber]
    );

    console.log('Tutor dismissed expired query:', { queryId: queryIdNumber, tutorId: tutorIdNumber });

    res.json({ ok: true, message: 'Expired query dismissed successfully' });
  } catch (error) {
    console.error('Error dismissing expired query:', error);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// ------------------------
// PUT /queries/profile
// ------------------------
router.put('/profile', async (req, res) => {
  const { userId, bio, education, specialties, ratePer10Min } = req.body;

  const userIdNumber = Number(userId);
  if (!Number.isInteger(userIdNumber)) {
    return res.status(400).json({ message: 'Invalid userId' });
  }

  const sanitizedSpecialties = Array.isArray(specialties) ? specialties : [];
  
  // ✅ CRITICAL: Handle rate correctly - null/undefined means "not set", 0 means "free"
  // If ratePer10Min is explicitly 0, it's a valid free rate
  // If ratePer10Min is null/undefined/empty string, it means "not set" (null)
  let sanitizedRate = null;
  if (ratePer10Min !== null && ratePer10Min !== undefined && ratePer10Min !== "") {
    const rateNum = Number(ratePer10Min);
    if (Number.isNaN(rateNum)) {
      return res.status(400).json({ message: 'ratePer10Min must be a valid number' });
    }
    if (rateNum < 0) {
      return res.status(400).json({ message: 'ratePer10Min must be non-negative' });
    }
    sanitizedRate = rateNum; // Can be 0 (free) or positive number
  }

  try {
    const updateResult = await pool.query(
      `UPDATE users
          SET bio = $2,
              education = $3,
              specialties = $4,
              rate_per_10_min = $5,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_type = 'tutor'
    RETURNING id`,
      [userIdNumber, bio || null, education || null, sanitizedSpecialties, sanitizedRate]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Tutor profile updated:', {
      userId: userIdNumber,
      bio,
      education,
      specialties: sanitizedSpecialties,
      ratePer10Min: sanitizedRate
    });

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating tutor profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /tutors/:id
router.get('/tutors/:id', async (req, res) => {
  const tutorId = Number(req.params.id);
  if (!Number.isInteger(tutorId)) {
    return res.status(400).json({ message: 'Invalid tutor ID' });
  }

  try {
    const tutorResult = await pool.query(
      `SELECT id,
              username,
              bio,
              education,
              specialties,
              rate_per_10_min,
              created_at,
              updated_at
         FROM users
        WHERE id = $1
          AND user_type = 'tutor'`,
      [tutorId]
    );

    if (tutorResult.rows.length === 0) {
      return res.status(404).json({ message: 'Tutor not found' });
    }

    const tutor = tutorResult.rows[0];

    // Compute average rating and count (from sessions table)
    const statsResult = await pool.query(
      `SELECT 
          AVG(rating) AS avg_rating,
          COUNT(rating) AS ratings_count
       FROM sessions
      WHERE tutor_id = $1
        AND rating IS NOT NULL`,
      [tutorId]
    );

    const { avg_rating, ratings_count } = statsResult.rows[0];

    res.json({
      id: tutor.id,
      name: tutor.username,
      bio: tutor.bio || "This tutor hasn't added a bio yet.",
      education: tutor.education || "Education not specified",
      specialties: tutor.specialties || [],
      rate: tutor.rate_per_10_min || null,
      averageRating: avg_rating ? Number(avg_rating).toFixed(1) : null,
      ratingsCount: ratings_count ? Number(ratings_count) : 0,
      createdAt: tutor.created_at,
      updatedAt: tutor.updated_at
    });
  } catch (err) {
    console.error("Error fetching tutor details:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ------------------------
// DEBUG: GET /queries/debug/users-tokens
// Development-only endpoint to inspect token balances
// ------------------------
router.get('/debug/users-tokens', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, username, user_type, tokens 
         FROM users 
     ORDER BY id ASC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error in debug/users-tokens:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { router, setIO };
