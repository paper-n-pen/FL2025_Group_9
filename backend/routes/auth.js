// backend/routes/auth.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const { normalizeEmail, normalizeUserType } = require("../utils/userNormalization");

const isProd = process.env.NODE_ENV === "production";

// --- REGISTER ---
router.post("/register", async (req, res) => {
  const {
    name,
    username, // support both name and username for backward compatibility
    email,
    password,
    role,
    user_type, // support both role and user_type for backward compatibility
    education,
    subjects,
    specialties, // support both subjects and specialties
    price_per_hour,
    rate,
    rate_per_10_min,
  } = req.body;

  // Normalize: use 'name' or 'username', 'role' or 'user_type'
  const userName = name || username;
  const normalizedEmail = normalizeEmail(email);
  const userRole = normalizeUserType(role ?? user_type, "student");

  console.log("Registration attempt:", { name: userName, email: normalizedEmail, role: userRole });

  // Validation
  if (!userName || !normalizedEmail || !password) {
    console.log("Missing required fields:", { name: !!userName, email: !!normalizedEmail, password: !!password });
    return res
      .status(400)
      .json({ error: "name, email, and password are required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    // Check if user already exists with the same role
    const existingUser = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND user_type = $2`,
      [normalizedEmail, userRole]
    );
    if (existingUser.rows.length > 0) {
      return res
        .status(409)
        .json({ error: `Email already registered as ${userRole}` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Normalize specialties/subjects: ensure array format
    let parsedSpecialties = [];
    const specialtiesInput = subjects || specialties;
    if (Array.isArray(specialtiesInput)) {
      parsedSpecialties = specialtiesInput;
    } else if (typeof specialtiesInput === "string" && specialtiesInput.trim() !== "") {
      parsedSpecialties = specialtiesInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    // Normalize rate (support both price_per_hour and rate_per_10_min)
    let rateValue = null;
    if (price_per_hour !== undefined && price_per_hour !== null) {
      // Convert hourly rate to per 10 minutes: hourly / 6
      rateValue = Number(price_per_hour) / 6;
    } else if (rate_per_10_min !== undefined && rate_per_10_min !== null) {
      rateValue = Number(rate_per_10_min);
    } else if (rate !== undefined && rate !== null) {
      rateValue = Number(rate);
    }

    // --- Tutor registration ---
    if (userRole === "tutor") {
      const result = await pool.query(
        `
        INSERT INTO users
          (username, email, password_hash, user_type, education, specialties, rate_per_10_min)
        VALUES ($1, $2, $3, $4, $5, $6::text[], $7)
        RETURNING id, username as name, email, user_type as role
        `,
        [
          userName,
          normalizedEmail,
          hashedPassword,
          "tutor",
          education || "",
          parsedSpecialties,
          rateValue,
        ]
      );

      const user = result.rows[0];
      return res.status(201).json({
        id: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
      });
    }

    // --- Student registration ---
    const result = await pool.query(
      `
      INSERT INTO users (username, email, password_hash, user_type)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username as name, email, user_type as role
      `,
      [userName, normalizedEmail, hashedPassword, "student"]
    );

    const user = result.rows[0];
    res.status(201).json({
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    });
  } catch (err) {
    console.error("Registration failed:", err);
    console.error("Error stack:", err.stack);
    const errorMessage = err.message || "Server error during registration. Check console logs.";
    console.error("Sending error response:", { status: 500, error: errorMessage });
    res.status(500).json({
      error: errorMessage,
    });
  }
});

// --- LOGIN (sets cookie) ---
router.post("/login", async (req, res) => {
  const { email, password, role, user_type } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const requestedRole = normalizeUserType(role ?? user_type, "");
  console.log("POST /login", normalizedEmail);

  if (!normalizedEmail || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const values = [normalizedEmail];
    let loginQuery = "SELECT * FROM users WHERE LOWER(email) = LOWER($1)";

    if (requestedRole) {
      loginQuery += " AND user_type = $2";
      values.push(requestedRole);
    }

    loginQuery += " ORDER BY user_type ASC";

    const result = await pool.query(loginQuery, values);
    if (result.rows.length === 0) {
      if (requestedRole) {
        const roleCheck = await pool.query(
          `SELECT DISTINCT user_type FROM users WHERE LOWER(email) = LOWER($1)` ,
          [normalizedEmail]
        );
        if (roleCheck.rows.length > 0) {
          const availableRoles = roleCheck.rows.map((row) => row.user_type).join(" & ");
          return res.status(409).json({
            error: `Email registered as ${availableRoles}. Please use the matching login page.`,
          });
        }
      }
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (!requestedRole && result.rows.length > 1) {
      return res.status(409).json({
        error: "Multiple accounts found for this email. Please select student or tutor login.",
      });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.user_type },
      process.env.JWT_SECRET || 'dev-secret-change-me',
      { expiresIn: "7d" }
    );

    // Cookie settings: dev-safe (secure: false, sameSite: 'lax')
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,     // dev only; set true behind HTTPS in prod
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    const responseData = {
      id: user.id,
      role: user.user_type,
      name: user.username,
      email: user.email,
    };
    console.log("Login successful for:", user.email, "role:", user.user_type);
    res.status(200).json(responseData);
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- AUTH CHECK (/me) ---
router.get("/me", async (req, res) => {
  try {
    // Support both 'token' and 'authToken' cookie names for backward compatibility
    const token = req.cookies?.token || req.cookies?.authToken;
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');

    const result = await pool.query(
      `SELECT id, username, email, user_type, bio, education, specialties, rate_per_10_min
       FROM users WHERE id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const row = result.rows[0];
    const user = {
      id: row.id,
      role: row.user_type,
      name: row.username,
      email: row.email,
      bio: row.bio || "",
      education: row.education || "",
      specialties: row.specialties || [],
      ratePer10Min: row.rate_per_10_min || 0,
    };

    res.json({ user });
  } catch (err) {
    console.error("Error in /me:", err);
    res.status(401).json({ error: "Invalid or expired token" });
  }
});


// --- LOGOUT ---
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
  res.status(204).send();
});

module.exports = router;
