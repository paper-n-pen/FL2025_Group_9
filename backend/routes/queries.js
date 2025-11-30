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
  const tutorId = Number(req.params.tutorId);
  if (!Number.isInteger(tutorId)) {
    return res.status(400).json({ message: 'Invalid tutorId' });
  }

  try {
    const tutorResult = await pool.query(
      `SELECT id, user_type, specialties, rate_per_10_min
         FROM users
        WHERE id = $1`,
      [tutorId]
    );

    if (tutorResult.rows.length === 0 || tutorResult.rows[0].user_type !== 'tutor') {
      return res.status(404).json({ message: 'Tutor not found' });
    }

    const tutorRow = tutorResult.rows[0];
    const tutorSpecialties = Array.isArray(tutorRow.specialties) ? tutorRow.specialties : [];
    const normalized = tutorSpecialties
      .map((s) => String(s).trim().toLowerCase())
      .filter(Boolean);

    const params = [tutorId];
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
  const tutorId = Number(req.params.tutorId);
  if (!Number.isInteger(tutorId)) {
    return res.status(400).json({ message: 'Invalid tutorId' });
  }

  try {
    const tutorResult = await pool.query(
      `SELECT id, user_type, rate_per_10_min
         FROM users
        WHERE id = $1`,
      [tutorId]
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
     ORDER BY COALESCE(q.updated_at, q.created_at) DESC`,
      [tutorId]
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

  const queryIdNumber = Number(queryId);
  const tutorIdNumber = Number(tutorId);

  if (!Number.isInteger(queryIdNumber) || !Number.isInteger(tutorIdNumber)) {
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
      [tutorIdNumber]
    );

    if (tutorResult.rows.length === 0 || tutorResult.rows[0].user_type !== 'tutor') {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Tutor not found' });
    }

    const tutorRow = tutorResult.rows[0];

    // Check if acceptance already exists
    const existingAcceptance = await client.query(
      `SELECT status FROM query_acceptances 
       WHERE query_id = $1 AND tutor_id = $2`,
      [queryIdNumber, tutorIdNumber]
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
          [queryIdNumber, tutorIdNumber]
        );
      }
    } else {
      // Insert new acceptance
      await client.query(
        `INSERT INTO query_acceptances (query_id, tutor_id, status)
         VALUES ($1, $2, 'PENDING')`,
        [queryIdNumber, tutorIdNumber]
      );
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
      [queryIdNumber, tutorIdNumber]
    );

    await client.query('COMMIT');

    console.log('Tutor accepted query:', { queryId: queryIdNumber, tutorId: tutorIdNumber });

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

  const queryIdNumber = Number(queryId);
  const tutorIdNumber = Number(tutorId);
  const studentIdNumber = Number(studentId);

  if (
    !Number.isInteger(queryIdNumber) ||
    !Number.isInteger(tutorIdNumber) ||
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
      [queryIdNumber, tutorIdNumber, studentIdNumber]
    );

    await client.query(
      `UPDATE queries
          SET status = 'in-session',
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [queryIdNumber]
    );

    await client.query('COMMIT');

    console.log('Session created:', {
      queryId: queryIdNumber,
      tutorId: tutorIdNumber,
      studentId: studentIdNumber
    });

    // Emit real-time events to notify both tutor and student
    if (io) {
      // Notify tutor that session is ready
      io.to(`tutor-${tutorIdNumber}`).emit('session-created', {
        queryId: queryIdNumber.toString(),
        sessionId: sessionResult.rows[0].id.toString(),
        message: 'Session created successfully. You can now enter the session.'
      });

      // Notify student that session is ready
      io.to(`student-${studentIdNumber}`).emit('session-ready', {
        queryId: queryIdNumber.toString(),
        sessionId: sessionResult.rows[0].id.toString(),
        tutorId: tutorIdNumber.toString(),
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

    // 7) Update users
    await client.query(
      `UPDATE users SET tokens = $1 WHERE id = $2`,
      [studentNew, session.student_id]
    );

    await client.query(
      `UPDATE users SET tokens = $1 WHERE id = $2`,
      [tutorNew, session.tutor_id]
    );

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

    // 🔥 EMIT SOCKET EVENT to notify tutor of coin earning
    if (io) {
      io.to(`tutor-${session.tutor_id}`).emit('coins-updated', {
        userId: session.tutor_id,
        newBalance: tutorNew,
        earned: rate,
        reason: 'session-started',
      });
      console.log('[🪙 COINS] 📢 Socket event sent to tutor:', {
        tutorId: session.tutor_id,
        room: `tutor-${session.tutor_id}`,
        newBalance: tutorNew,
        earned: rate,
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

  try {
    // Verify this user is part of this session
    const { rows: sessionRows } = await pool.query(
      `SELECT student_id, tutor_id FROM sessions WHERE id = $1`,
      [sessionIdNumber]
    );

    if (sessionRows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Session not found',
      });
    }

    const session = sessionRows[0];
    const isStudentInSession = session.student_id === userIdNumber;
    const isTutorInSession = session.tutor_id === userIdNumber;

    if (!isStudentInSession && !isTutorInSession) {
      return res.status(403).json({
        ok: false,
        message: 'User is not part of this session',
      });
    }

    // Get user's current coins
    const { rows: userRows } = await pool.query(
      `SELECT id, user_type, tokens FROM users WHERE id = $1`,
      [userIdNumber]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'User not found',
      });
    }

    const user = userRows[0];
    const coins = Number(user.tokens ?? 0);

    console.log('[🪙 COINS GET] Fetched coins for user in session:', {
      sessionId: sessionIdNumber,
      userId: userIdNumber,
      userType: user.user_type,
      coins,
    });

    return res.json({
      ok: true,
      userId: user.id,
      userType: user.user_type,
      coins,
    });
  } catch (err) {
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
      `SELECT id, query_id, status
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

    await client.query(
      `UPDATE sessions SET status = 'ended' WHERE id = $1`,
      [sessionIdNumber]
    );

    // Delete the query from database when session is completely ended
    // Related records (sessions, query_acceptances, query_declines) will be cascade deleted
    await client.query(
      `DELETE FROM queries WHERE id = $1`,
      [sessionRow.query_id]
    );

    await client.query('COMMIT');

    if (io) {
      const payload = {
        sessionId: sessionIdNumber.toString(),
        endedBy: endedByNumber.toString(),
        queryId: sessionRow.query_id ? sessionRow.query_id.toString() : null,
        tutorId: queryInfo?.accepted_tutor_id ? queryInfo.accepted_tutor_id.toString() : null,
        studentId: queryInfo?.student_id ? queryInfo.student_id.toString() : null
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

    await client.query(
      `UPDATE sessions
          SET rating = $1
        WHERE id = $2`,
      [ratingNumber, sessionIdNumber]
    );

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
              qa.accepted_at AS tutor_accepted_at,
              qa.status AS acceptance_status,
              s.id AS session_id,
              s.status AS session_status,
              rs.avg_rating AS tutor_avg_rating,
              rs.ratings_count AS tutor_ratings_count
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
    LEFT JOIN LATERAL (
           SELECT AVG(rating) AS avg_rating,
                  COUNT(rating) AS ratings_count
             FROM sessions
            WHERE tutor_id = qa.tutor_id
              AND rating IS NOT NULL
    ) rs ON TRUE
        WHERE q.student_id = $1
     ORDER BY q.id DESC, qa.accepted_at DESC`,
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
        tutorAverageRating:
          row.tutor_avg_rating !== null && row.tutor_avg_rating !== undefined
            ? Number(row.tutor_avg_rating)
            : null,
        tutorRatingsCount: row.tutor_ratings_count ? Number(row.tutor_ratings_count) : 0,
        acceptanceStatus: row.acceptance_status || 'PENDING',
        isSelected: row.acceptance_status === 'SELECTED' || row.student_selected_tutor_id === row.tutor_id
      });
    });

    // Convert to array format
    const responses = Object.values(responsesByQuery);

    res.json(responses);
  } catch (error) {
    console.error('Error fetching student responses:', error);
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
  const sanitizedRate =
    ratePer10Min !== null && ratePer10Min !== undefined ? Number(ratePer10Min) : null;

  if (sanitizedRate !== null) {
    if (Number.isNaN(sanitizedRate)) {
      return res.status(400).json({ message: 'ratePer10Min must be a valid number' });
    }
    if (sanitizedRate < 0) {
      return res.status(400).json({ message: 'ratePer10Min must be non-negative' });
    }
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
