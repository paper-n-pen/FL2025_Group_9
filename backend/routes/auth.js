// backend/routes/auth.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { pool } = require("../db"); // ensure you export `pool` correctly in db.js
const cookieParser = require("cookie-parser");

// --- REGISTER ---
router.post("/register", async (req, res) => {
  const { username, email, password, user_type } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: "username, email, and password are required" });
  }

  try {
    // check if user exists
    const existingUser = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: "User already exists." });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // insert new user
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

// --- LOGIN (sets secure cookie) ---
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("POST /login endpoint hit");
  console.log("Request body:", req.body);

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0)
      return res.status(400).json({ message: "User not found." });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ message: "Invalid password." });

    // Create JWT payload
    const token = jwt.sign(
      { id: user.id, username: user.username, userType: user.user_type },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // ✅ Set cookie (HTTP-only)
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // only HTTPS in prod
      sameSite: "strict",
      maxAge: 3600000, // 1 hour
    });

    // ✅ Send user info to client
    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        userType: user.user_type,
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

    if (result.rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    const user = result.rows[0];
    res.json({ user });
  } catch (err) {
    console.error("Error in /me:", err);
    res.status(401).json({ message: "Invalid or expired token" });
  }
});

// --- LOGOUT (clears cookie) ---
router.post("/logout", (req, res) => {
  res.clearCookie("authToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.json({ message: "Logged out successfully" });
});

module.exports = router;
