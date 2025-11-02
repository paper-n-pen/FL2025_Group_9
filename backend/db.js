// backend/db.js
const { Pool } = require("pg");
require("dotenv").config();

// Create a new pool (shared connection manager)
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl:
          process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false } // ✅ allow SSL for Render/Heroku
            : false,
      }
    : {
        user: process.env.DB_USER || "myapp_user",
        host: process.env.DB_HOST || "localhost",
        database: process.env.DB_NAME || "myapp_db",
        password: process.env.DB_PASSWORD || "secret",
        port: process.env.DB_PORT || 5432,
      }
);

// Optional: Log successful connection once
pool
  .connect()
  .then((client) => {
    console.log("✅ PostgreSQL connected successfully");
    client.release();
  })
  .catch((err) => console.error("❌ PostgreSQL connection error:", err.stack));

module.exports = { pool };
