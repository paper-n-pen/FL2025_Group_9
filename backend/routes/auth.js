// backend/routes/auth.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const { normalizeEmail } = require("../utils/userNormalization");

const isProd = process.env.NODE_ENV === "production";

/**
 * Strictly normalize role.
 * Only "student" or "tutor" are valid.
 * Anything else -> null (handled as error in the route).
 */
const normalizeRole = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "student" || normalized === "tutor") {
    return normalized;
  }
  return null;
};

// -----------------------------
// POST /register
// -----------------------------
router.post("/register", async (req, res) => {
  const {
    name,
    username,       // backward compatibility
    email,
    password,
    role,
    user_type,      // backward compatibility
    education,
    specialties,
    subjects,       // backward compatibility for older payloads
    price_per_hour, // optional
    rate_per_10_min,
    rate            // optional alias
  } = req.body;

  // --- Normalize basic fields ---
  const userName = (name || username || "").trim();
  const normalizedEmail = normalizeEmail(email);

  // If role/user_type omitted, default to "student" to match old behavior *safely*
  const rawRole = (role ?? user_type ?? "student");
  const userRole = normalizeRole(rawRole);

  if (!userRole) {
    return res.status(400).json({
      error: "Invalid user role. Must be 'student' or 'tutor'.",
    });
  }

  if (!userName || !normalizedEmail || !password) {
    return res.status(400).json({
      error: "name, email, and password are required",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      error: "Password must be at least 6 characters",
    });
  }

  try {
    // Ensure email+role is unique (matches your UNIQUE index)
    const existing = await pool.query(
      `SELECT id 
         FROM users 
        WHERE LOWER(email) = LOWER($1) AND user_type = $2`,
      [normalizedEmail, userRole]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: `Email already registered as ${userRole}.`,
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // ---------- SPECIALTIES NORMALIZATION ----------
    let parsedSpecialties = [];
    const specialtiesInput = specialties || subjects;

    if (Array.isArray(specialtiesInput)) {
      parsedSpecialties = specialtiesInput
        .map((s) => String(s).trim())
        .filter(Boolean);
    } else if (typeof specialtiesInput === "string" && specialtiesInput.trim() !== "") {
      parsedSpecialties = specialtiesInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    // ---------- RATE NORMALIZATION (to rate_per_10_min) ----------
    let normalizedRate = null;
    if (price_per_hour !== undefined && price_per_hour !== null) {
      const hourly = Number(price_per_hour);
      if (Number.isNaN(hourly) || hourly < 0) {
        return res.status(400).json({ error: "price_per_hour must be a valid non-negative number" });
      }
      normalizedRate = hourly / 6;
    } else if (rate_per_10_min !== undefined && rate_per_10_min !== null) {
      const r = Number(rate_per_10_min);
      if (Number.isNaN(r) || r < 0) {
        return res.status(400).json({ error: "rate_per_10_min must be a valid non-negative number" });
      }
      normalizedRate = r;
    } else if (rate !== undefined && rate !== null) {
      const r = Number(rate);
      if (Number.isNaN(r) || r < 0) {
        return res.status(400).json({ error: "rate must be a valid non-negative number" });
      }
      normalizedRate = r;
    }

    // ===========================
    // TUTOR REGISTRATION
    // ===========================
    if (userRole === "tutor") {
      const result = await pool.query(
        `
        INSERT INTO users
          (username, email, password_hash, user_type, bio, education, specialties, rate_per_10_min, tokens)
        VALUES ($1, $2, $3, 'tutor', $4, $5, $6::text[], $7, 0)
        RETURNING id, username AS name, email, user_type AS role, tokens
        `,
        [
          userName,
          normalizedEmail,
          passwordHash,
          "",                        // default empty bio
          education || "",
          parsedSpecialties,
          normalizedRate,
        ]
      );

      const user = result.rows[0];
      return res.status(201).json({
        id: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        tokens: user.tokens || 0,
      });
    }

    // ===========================
    // STUDENT REGISTRATION
    // ===========================
    const studentResult = await pool.query(
      `
      INSERT INTO users (username, email, password_hash, user_type, tokens)
      VALUES ($1, $2, $3, 'student', 100)
      RETURNING id, username AS name, email, user_type AS role, tokens
      `,
      [userName, normalizedEmail, passwordHash]
    );

    const student = studentResult.rows[0];
    return res.status(201).json({
      id: student.id,
      role: student.role,
      name: student.name,
      email: student.email,
      tokens: student.tokens || 100,
    });
  } catch (err) {
    console.error("Registration failed:", err);
    // Log more details for debugging
    if (err.code) {
      console.error("Database error code:", err.code);
      console.error("Database error detail:", err.detail);
    }
    return res.status(500).json({ 
      error: "Server error during registration.",
      message: process.env.NODE_ENV === "development" ? err.message : undefined
    });
  }
});

// -----------------------------
// POST /login
// -----------------------------
router.post("/login", async (req, res) => {
  const { email, password, role, user_type } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const requestedRole = normalizeRole(role ?? user_type ?? null);

  if (!normalizedEmail || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    let user = null;

    if (requestedRole) {
      // Explicit role: student or tutor
      const result = await pool.query(
        `SELECT * 
           FROM users 
          WHERE LOWER(email) = LOWER($1)
            AND user_type = $2
          ORDER BY id ASC`,
        [normalizedEmail, requestedRole]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          error: `No ${requestedRole} account found for this email.`,
        });
      }

      user = result.rows[0];
    } else {
      // No explicit role: check how many roles exist for this email
      const result = await pool.query(
        `SELECT * 
           FROM users 
          WHERE LOWER(email) = LOWER($1)
          ORDER BY user_type ASC`,
        [normalizedEmail]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      if (result.rows.length > 1) {
        const availableRoles = result.rows.map((row) => row.user_type).join(" & ");
        return res.status(409).json({
          error: `Multiple accounts found (${availableRoles}). Please use the student or tutor login page.`,
        });
      }

      user = result.rows[0];
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.user_type },
      process.env.JWT_SECRET || "dev-secret-change-me",
      { expiresIn: "7d" }
    );

    // Single canonical cookie name "token" (still read authToken in /me for compatibility)
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    const tokens = user.tokens !== null && user.tokens !== undefined 
      ? Number(user.tokens) 
      : (user.user_type === 'student' ? 100 : 0);
    
    const responseData = {
      id: user.id,
      role: user.user_type,
      name: user.username,
      email: user.email,
      tokens: tokens,
    };

    console.log("Login successful:", { email: user.email, role: user.user_type, userId: user.id, tokens: tokens });
    return res.status(200).json(responseData);
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// -----------------------------
// GET /me
// -----------------------------
router.get("/me", async (req, res) => {
  try {
    // ✅ CRITICAL FIX: Check expected user ID FIRST (from header or query param)
    // This prevents cookie conflicts when multiple tutors are logged in different tabs
    const expectedUserId = req.headers['x-expected-user-id'] || req.query.expectedUserId;
    
    // Support both 'token' and legacy 'authToken'
    const token = req.cookies?.token || req.cookies?.authToken;
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret-change-me");
    } catch (jwtError) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // ✅ CRITICAL: If frontend expects a specific user ID, verify cookie matches
    if (expectedUserId) {
      const expectedId = Number(expectedUserId);
      const cookieUserId = Number(decoded.id);
      
      // If cookie user doesn't match expected user, return 403 Forbidden
      // This tells frontend to use localStorage/sessionStorage data instead
      if (!Number.isNaN(expectedId) && !Number.isNaN(cookieUserId) && expectedId !== cookieUserId) {
        console.log('[AUTH] GET /me - Cookie user mismatch, rejecting request:', {
          expectedUserId: expectedId,
          cookieUserId: cookieUserId,
          action: 'Returning 403 to prevent data mixing'
        });
        return res.status(403).json({ 
          error: "User mismatch",
          code: "USER_MISMATCH",
          message: "Cookie user does not match expected user. Use localStorage data instead.",
          expectedUserId: expectedId,
          cookieUserId: cookieUserId
        });
      }
    }

    const result = await pool.query(
      `SELECT id,
              username,
              email,
              user_type,
              bio,
              education,
              specialties,
              rate_per_10_min,
              tokens
         FROM users
        WHERE id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const row = result.rows[0];
    
    const tokens = row.tokens !== null && row.tokens !== undefined ? Number(row.tokens) : 0;
    
    const user = {
      id: row.id,
      role: row.user_type,
      user_type: row.user_type, // 🔥 FIX: Add user_type for frontend compatibility
      userType: row.user_type,  // 🔥 FIX: Add userType for frontend compatibility
      name: row.username,
      username: row.username,
      email: row.email,
      bio: row.bio || "",
      education: row.education || "",
      specialties: row.specialties || [],
      ratePer10Min:
        row.rate_per_10_min !== null && row.rate_per_10_min !== undefined
          ? Number(row.rate_per_10_min)
          : null,
      tokens: tokens,
    };

    console.log('[AUTH] GET /me returning user:', {
      userId: user.id,
      user_type: user.user_type,
      tokens: user.tokens,
      cookieUserId: decoded.id,
    });

    return res.json({ user });
  } catch (err) {
    console.error("Error in /me:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

// -----------------------------
// POST /logout
// -----------------------------
router.post("/logout", (req, res) => {
  // Clear both cookie names for backward compatibility
  res.clearCookie("token", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  });
  res.clearCookie("authToken", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  });

  return res.status(204).send();
});

module.exports = router;
