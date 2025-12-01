// backend/services/botTools.js
// Read-only database tools for chatbot queries

const { pool } = require('../db');

/**
 * Get tutor information by name (username)
 * @param {string} name - Tutor username
 * @returns {Promise<Object|null>} - Tutor info or null if not found
 */
async function getTutorByName(name) {
  try {
    const result = await pool.query(
      `SELECT id, username, specialties, rate_per_10_min, bio, education, user_type
       FROM users
       WHERE LOWER(username) = LOWER($1) AND user_type = 'tutor'`,
      [name]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const tutorId = row.id;
    const specialties = Array.isArray(row.specialties) ? row.specialties : [];
    const ratePer10Min = row.rate_per_10_min !== null && row.rate_per_10_min !== undefined
      ? Number(row.rate_per_10_min)
      : null;

    // Calculate hourly rate (rate_per_10_min * 6)
    // Round to nearest whole number to show exactly what tutor set
    const pricePerHour = ratePer10Min !== null ? Math.round(ratePer10Min * 6) : null;

    // Pull rating stats from completed sessions
    const ratingResult = await pool.query(
      `SELECT 
         AVG(rating) AS avg_rating,
         COUNT(rating) AS ratings_count
       FROM sessions
       WHERE tutor_id = $1
         AND rating IS NOT NULL`,
      [tutorId]
    );

    const avgRating = ratingResult.rows[0]?.avg_rating;
    const formattedRating = avgRating !== null && avgRating !== undefined
      ? Number(avgRating).toFixed(1)
      : null;
    const reviewsCount = parseInt(ratingResult.rows[0]?.ratings_count || '0', 10);

    // Simple availability note based on active sessions
    const availabilityResult = await pool.query(
      `SELECT COUNT(*) as active_sessions
       FROM sessions
       WHERE tutor_id = $1
       AND status = 'active'`,
      [tutorId]
    );

    const activeSessions = parseInt(availabilityResult.rows[0]?.active_sessions || '0', 10);
    const availabilityNote = activeSessions === 0
      ? 'Available now'
      : `${activeSessions} active session${activeSessions > 1 ? 's' : ''}`;

    return {
      name: row.username,
      subjects: specialties,
      price_per_hour: pricePerHour,
      rate_per_10_min: ratePer10Min,
      rating: null, // No ratings table exists, but we can calculate from sessions
      reviews_count: reviewsCount,
      availability_note: availabilityNote,
      bio: row.bio,
      education: row.education,
      ratings_count: reviewsCount,
      rating: formattedRating,
    };
  } catch (error) {
    console.error('❌ Error in getTutorByName:', error.message);
    return null;
  }
}

/**
 * List tutors by subject
 * @param {string} subject - Subject name (case-insensitive)
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} - Array of tutor info objects
 */
async function listTutorsBySubject(subject, limit = 5) {
  try {
    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      console.log('[DB_ROWS] Empty subject, returning all tutors');
      return await listAllTutors(limit);
    }

    // Normalize subject - preserve case for special chars like C++, C#
    // But also try lowercase version for matching
    const normalizedSubject = subject.trim();
    const lowerSubject = normalizedSubject.toLowerCase();
    // Also create a version that handles common variations (e.g., "JavaScript" vs "Javascript")
    const alternateSubject = normalizedSubject === 'JavaScript' ? 'Javascript' : (normalizedSubject === 'Javascript' ? 'JavaScript' : normalizedSubject);
    console.log(`[DB_QUERY] Searching for tutors with subject: "${normalizedSubject}" (lowercase: "${lowerSubject}", alternate: "${alternateSubject}")`);

    // Query using TEXT[] array operations - case-insensitive matching
    // Handle special characters like +, # by using ILIKE and multiple matching strategies
    // CRITICAL: Use comprehensive case-insensitive matching to find all variations
    // Also handle common variations like "JavaScript" vs "Javascript"
    // Also fetch stored average_rating and review_count from users table
    const result = await pool.query(
      `SELECT 
         u.id,
         u.username as name,
         u.specialties as subjects,
         u.rate_per_10_min,
         u.bio,
         u.average_rating,
         u.review_count,
         COUNT(s.id) FILTER (WHERE s.status = 'completed') as completed_sessions,
         AVG(s.rating) FILTER (WHERE s.rating IS NOT NULL) as avg_rating,
         COUNT(s.rating) FILTER (WHERE s.rating IS NOT NULL) as ratings_count
       FROM users u
       LEFT JOIN sessions s ON s.tutor_id = u.id
       WHERE u.user_type = 'tutor'
       AND EXISTS (
         SELECT 1 FROM unnest(u.specialties) AS spec
         WHERE 
           -- Case-insensitive exact match using LOWER() - most reliable
           LOWER(TRIM(spec)) = $1
           OR LOWER(TRIM(spec)) = LOWER($2)
           OR LOWER(TRIM(spec)) = LOWER($3)
           -- Case-insensitive pattern match using LOWER() and LIKE
           OR LOWER(TRIM(spec)) LIKE '%' || $1 || '%'
           OR LOWER(TRIM(spec)) LIKE '%' || LOWER($2) || '%'
           OR LOWER(TRIM(spec)) LIKE '%' || LOWER($3) || '%'
           -- Also try ILIKE for pattern matching (handles special chars better)
           OR TRIM(spec) ILIKE '%' || $1 || '%'
           OR TRIM(spec) ILIKE '%' || $2 || '%'
           OR TRIM(spec) ILIKE '%' || $3 || '%'
       )
       GROUP BY u.id, u.username, u.specialties, u.rate_per_10_min, u.bio, u.average_rating, u.review_count
       ORDER BY u.rate_per_10_min ASC NULLS LAST, completed_sessions DESC
       LIMIT $4`,
      [lowerSubject, normalizedSubject, alternateSubject, limit]
    );

    console.log(`[DB_ROWS] Found ${result.rows.length} tutors for subject "${normalizedSubject}" (searched with: lowercase="${lowerSubject}", normalized="${normalizedSubject}", alternate="${alternateSubject}")`);
    
    // Debug: Log what we're searching for and what was found
    if (result.rows.length > 0) {
      console.log(`[DB_DEBUG] Found tutors: ${result.rows.map(r => r.name).join(', ')}`);
      console.log(`[DB_DEBUG] Tutor specialties: ${result.rows.map(r => `${r.name}: [${r.subjects.join(', ')}]`).join('; ')}`);
    } else {
      // If no results, check what specialties actually exist in the database
      const debugResult = await pool.query(
        `SELECT DISTINCT unnest(specialties) as spec 
         FROM users 
         WHERE user_type = 'tutor' 
         ORDER BY spec`,
        []
      );
      const allSpecialties = debugResult.rows.map(r => r.spec);
      console.log(`[DB_DEBUG] Available specialties in database: ${allSpecialties.join(', ')}`);
      console.log(`[DB_DEBUG] Searching for: "${lowerSubject}" (lowercase) and "${normalizedSubject}" (normalized)`);
      
      // Test if the subject exists in any form
      const testResult = await pool.query(
        `SELECT DISTINCT unnest(specialties) as spec 
         FROM users 
         WHERE user_type = 'tutor' 
           AND (
             TRIM(spec) ILIKE $1
             OR TRIM(spec) ILIKE $2
             OR TRIM(spec) ILIKE '%' || $1 || '%'
             OR TRIM(spec) ILIKE '%' || $2 || '%'
           )
         ORDER BY spec`,
        [lowerSubject, normalizedSubject]
      );
      console.log(`[DB_DEBUG] Test query found specialties: ${testResult.rows.map(r => r.spec).join(', ')}`);
    }

    return result.rows.map(row => {
      // The query uses 'u.specialties as subjects', so access row.subjects (not row.specialties)
      // Handle PostgreSQL array - could be array or string representation
      let specialties = [];
      const rawSubjects = row.subjects; // This is the alias from the query
      
      if (Array.isArray(rawSubjects)) {
        specialties = rawSubjects;
      } else if (rawSubjects && typeof rawSubjects === 'string') {
        // PostgreSQL might return array as string like "{C++}" or "{Python,Java}"
        const cleaned = rawSubjects.replace(/[{}]/g, '');
        specialties = cleaned ? cleaned.split(',').map(s => s.trim()).filter(Boolean) : [];
      }
      
      console.log(`  📋 Tutor "${row.name}": specialties=${JSON.stringify(specialties)} (raw: ${JSON.stringify(rawSubjects)}, type: ${typeof rawSubjects})`);
      
      const ratePer10Min = row.rate_per_10_min !== null && row.rate_per_10_min !== undefined
        ? Number(row.rate_per_10_min)
        : null;
      // Round to nearest whole number to show exactly what tutor set
      const pricePerHour = ratePer10Min !== null ? Math.round(ratePer10Min * 6) : null;

      // Prefer stored rating from users table, fall back to calculated from sessions
      const storedRating = row.average_rating !== null && row.average_rating !== undefined
        ? Number(row.average_rating)
        : null;
      const calculatedRating = row.avg_rating !== null && row.avg_rating !== undefined
        ? Number(row.avg_rating)
        : null;
      const finalRating = storedRating !== null ? storedRating : calculatedRating;
      
      // Prefer stored review_count from users table, fall back to calculated from sessions
      const storedReviewCount = row.review_count !== null && row.review_count !== undefined
        ? parseInt(row.review_count, 10)
        : null;
      const calculatedReviewCount = row.ratings_count !== null && row.ratings_count !== undefined
        ? parseInt(row.ratings_count, 10)
        : null;
      const finalReviewCount = storedReviewCount !== null ? storedReviewCount : (calculatedReviewCount !== null ? calculatedReviewCount : 0);

      return {
        name: row.name || row.username,
        subjects: specialties,
        price_per_hour: pricePerHour,
        rate_per_10_min: ratePer10Min,
        rating: finalRating !== null ? finalRating.toFixed(1) : null,
        reviews_count: finalReviewCount,
      };
    });
  } catch (error) {
    console.error('❌ Error in listTutorsBySubject:', error.message);
    return []; // Return empty array - no mock data fallback
  }
}

/**
 * Get pricing summary across all active tutors
 * @returns {Promise<Object>} - Pricing statistics
 */
async function getPricingSummary() {
  try {
    const result = await pool.query(
      `SELECT 
         MIN(rate_per_10_min * 6) as min_price,
         MAX(rate_per_10_min * 6) as max_price,
         AVG(rate_per_10_min * 6) as avg_price,
         COUNT(*) as tutor_count
       FROM users
       WHERE user_type = 'tutor' AND rate_per_10_min IS NOT NULL`
    );

    if (result.rows.length === 0 || result.rows[0].tutor_count === '0') {
      return { min_price: null, max_price: null, avg_price: null, tutor_count: 0 };
    }

    const row = result.rows[0];
    return {
      min_price: row.min_price ? Number(row.min_price) : null,
      max_price: row.max_price ? Number(row.max_price) : null,
      avg_price: row.avg_price ? Number(row.avg_price) : null,
      tutor_count: parseInt(row.tutor_count, 10),
    };
  } catch (error) {
    console.error('❌ Error in getPricingSummary:', error.message);
    return { min_price: null, max_price: null, avg_price: null, tutor_count: 0 };
  }
}

/**
 * Get tutor ratings/reviews (approximated from sessions)
 * @param {string} name - Tutor username
 * @returns {Promise<Object|null>} - Rating info or null
 */
async function getTutorRatings(name) {
  try {
    // First get tutor ID
    const tutorResult = await pool.query(
      `SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND user_type = 'tutor'`,
      [name]
    );

    if (tutorResult.rows.length === 0) {
      return null;
    }

    const tutorId = tutorResult.rows[0].id;

    const result = await pool.query(
      `SELECT 
         COUNT(rating) as reviews_count,
         AVG(rating) as avg_rating,
         MAX(created_at) as last_review_at
       FROM sessions
       WHERE tutor_id = $1
         AND rating IS NOT NULL`,
      [tutorId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      rating: row.avg_rating !== null && row.avg_rating !== undefined
        ? Number(row.avg_rating).toFixed(1)
        : null,
      reviews_count: parseInt(row.reviews_count || '0', 10),
      last_review_at: row.last_review_at,
    };
  } catch (error) {
    console.error('❌ Error in getTutorRatings:', error.message);
    return null;
  }
}

/**
 * Get policy information (not implemented - no policies table)
 * @param {string} key - Policy key (login, payment, refund, booking, cancel, reschedule)
 * @returns {Promise<Object|null>} - Always returns null as no policies table exists
 */
async function getPolicy(key) {
  // No policies table exists in the schema
  // Return null - RAG will handle policy questions
  return null;
}

/**
 * List all tutors with basic info (for general queries)
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} - Array of tutor info
 */
async function listAllTutors(limit = 10) {
  try {
    const result = await pool.query(
      `SELECT 
         u.username,
         u.specialties,
         u.rate_per_10_min,
         u.average_rating,
         u.review_count,
         COUNT(s.id) FILTER (WHERE s.status = 'completed') as completed_sessions,
         AVG(s.rating) FILTER (WHERE s.rating IS NOT NULL) as avg_rating,
         COUNT(s.rating) FILTER (WHERE s.rating IS NOT NULL) as ratings_count
       FROM users u
       LEFT JOIN sessions s ON s.tutor_id = u.id
       WHERE u.user_type = 'tutor'
       GROUP BY u.id, u.username, u.specialties, u.rate_per_10_min, u.average_rating, u.review_count
       ORDER BY u.username
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => {
      const specialties = Array.isArray(row.specialties) ? row.specialties : [];
      const ratePer10Min = row.rate_per_10_min !== null && row.rate_per_10_min !== undefined
        ? Number(row.rate_per_10_min)
        : null;
      // Round to nearest whole number to show exactly what tutor set
      const pricePerHour = ratePer10Min !== null ? Math.round(ratePer10Min * 6) : null;

      // Prefer stored rating from users table, fall back to calculated from sessions
      const storedRating = row.average_rating !== null && row.average_rating !== undefined
        ? Number(row.average_rating)
        : null;
      const calculatedRating = row.avg_rating !== null && row.avg_rating !== undefined
        ? Number(row.avg_rating)
        : null;
      const finalRating = storedRating !== null ? storedRating : calculatedRating;
      
      // Prefer stored review_count from users table, fall back to calculated from sessions
      const storedReviewCount = row.review_count !== null && row.review_count !== undefined
        ? parseInt(row.review_count, 10)
        : null;
      const calculatedReviewCount = row.ratings_count !== null && row.ratings_count !== undefined
        ? parseInt(row.ratings_count, 10)
        : null;
      const finalReviewCount = storedReviewCount !== null ? storedReviewCount : (calculatedReviewCount !== null ? calculatedReviewCount : 0);

      return {
        name: row.username,
        subjects: specialties,
        price_per_hour: pricePerHour,
        rate_per_10_min: ratePer10Min,
        rating: finalRating !== null ? finalRating.toFixed(1) : null,
        reviews_count: finalReviewCount,
        rate_per_10_min: ratePer10Min,
        rating: row.avg_rating !== null && row.avg_rating !== undefined
          ? Number(row.avg_rating).toFixed(1)
          : null,
        reviews_count: parseInt(row.ratings_count || row.completed_sessions || '0', 10),
      };
    });
  } catch (error) {
    console.error('❌ Error in listAllTutors:', error.message);
    return []; // Return empty array - no mock data fallback
  }
}

module.exports = {
  getTutorByName,
  listTutorsBySubject,
  getPricingSummary,
  getTutorRatings,
  getPolicy,
  listAllTutors,
};

