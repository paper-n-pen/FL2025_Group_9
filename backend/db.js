// backend/db.js
const { Pool } = require("pg");
// Only load .env if not in Kubernetes (K8s sets env vars directly)
// dotenv doesn't override existing env vars, but we skip loading .env in K8s to be safe
if (!process.env.KUBERNETES_SERVICE_HOST) {
  require("dotenv").config();
}

// Read DB settings from DATABASE_URL or fallback to individual env vars
function getDbConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === "true" || process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false } // ✅ allow SSL for Render/Heroku
          : false,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection cannot be established
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
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection cannot be established
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
