// backend/db.js
const { Pool } = require("pg");
require("dotenv").config();

function parseBoolean(value) {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on", "require"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "disable", "disabled"].includes(normalized)) return false;
  return undefined;
}

function shouldUseSSL() {
  const explicitFlag =
    parseBoolean(process.env.DB_SSL) ??
    parseBoolean(process.env.DATABASE_SSL) ??
    (() => {
      const mode = (process.env.PGSSLMODE || "").toLowerCase();
      if (!mode) return undefined;
      if (mode === "disable") return false;
      if (["require", "verify-ca", "verify-full"].includes(mode)) return true;
      return undefined;
    })();

  if (typeof explicitFlag === "boolean") {
    return explicitFlag;
  }

  return process.env.NODE_ENV === "production";
}

function getSslConfig() {
  if (!shouldUseSSL()) {
    return false;
  }

  const rejectUnauthorized =
    parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED) ??
    parseBoolean(process.env.PGSSLREJECTUNAUTHORIZED);

  return {
    rejectUnauthorized: rejectUnauthorized !== false,
  };
}

// Read DB settings from DATABASE_URL or fallback to individual env vars
function getDbConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: getSslConfig(),
    };
  }
  
  // Build from individual env vars (PG* or DB_*)
  const user = process.env.PGUSER || process.env.DB_USER;
  const host = process.env.PGHOST || process.env.DB_HOST;
  const database = process.env.PGDATABASE || process.env.DB_NAME;
  const password = process.env.PGPASSWORD || process.env.DB_PASSWORD;
  const port = process.env.PGPORT || process.env.DB_PORT;
  
  if (!user || !host || !database || !password || !port) {
    console.warn('⚠️  Missing database environment variables. Using defaults.');
    console.warn('   Set DATABASE_URL or PGHOST/PGUSER/PGDATABASE/PGPASSWORD/PGPORT');
  }
  
  return {
    user: user || "myapp_user",
    host: host || "localhost",
    database: database || "myapp_db",
    password: password || "secret",
    port: parseInt(port || "5432", 10),
    ssl: getSslConfig(),
  };
}

// Create a new pool (shared connection manager)
const pool = new Pool(getDbConfig());

// Optional: Log successful connection once
pool
  .connect()
  .then((client) => {
    console.log("✅ PostgreSQL connected successfully");
    client.release();
  })
  .catch((err) => console.error("❌ PostgreSQL connection error:", err.stack));

module.exports = { pool };
