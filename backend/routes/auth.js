// backend/routes/auth.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { pool } = require("../db");

const isProd = process.env.NODE_ENV === "production";

// --- REGISTER ---
router.post("/register", async (req, res) => {
  const { username, email, password, user_type } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: "username, email, and password are required" });
  }

  try {
    const existingUser = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: "User already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, user_type)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, user_type`,
      [username, email, hashedPassword, user_type]
    );

    const newUser = result.rows[0];
    res.status(201).json({ message: "User registered successfully", user: newUser });
  } catch (err) {
    console.error("Registration failed:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// --- LOGIN (sets cookie) ---
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("POST /login", req.body?.email);

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ message: "User not found." });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ message: "Invalid password." });

    const token = jwt.sign(
      { id: user.id, username: user.username, userType: user.user_type },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Cookie settings: dev vs prod
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: isProd,                 // true only behind HTTPS
      sameSite: isProd ? "none" : "lax",
      maxAge: 60 * 60 * 1000,
      path: "/",
    });

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        userType: user.user_type,     // camelCase
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// --- AUTH CHECK (/me) ---
router.get("/me", async (req, res) => {
  try {
    const token = req.cookies?.authToken;
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query(
      "SELECT id, username, email, user_type FROM users WHERE id = $1",
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const row = result.rows[0];
    // Normalize to camelCase to match /login
    const user = {
      id: row.id,
      username: row.username,
      email: row.email,
      userType: row.user_type,
    };

    res.json({ user });
  } catch (err) {
    console.error("Error in /me:", err);
    res.status(401).json({ message: "Invalid or expired token" });
  }
});

// --- LOGOUT ---
router.post("/logout", (req, res) => {
  res.clearCookie("authToken", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  });
  res.json({ message: "Logged out successfully" });
});

module.exports = router;
