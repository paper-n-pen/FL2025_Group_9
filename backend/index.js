// backend/index.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { Server } = require("socket.io");
const http = require("http");
require("dotenv").config();

const { pool } = require("./db");
const authRoutes = require("./routes/auth"); // ✅ handles /register, /login, /me, /logout
const { router: queriesRoutes, setIO } = require("./routes/queries");
const passwordResetRoutes = require("./routes/passwordReset");
const aiRoutes = require("./routes/ai");

const app = express();
const server = http.createServer(app);

// Socket.IO CORS: allow multiple localhost origins (dev + Docker)
const socketCorsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : [
      'http://localhost',
      'http://localhost:80',
      'http://localhost:5173',
      'http://127.0.0.1',
      'http://127.0.0.1:80',
      'http://127.0.0.1:5173',
    ];

const io = new Server(server, {
  cors: {
    origin: socketCorsOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3000;

// --- Middleware ---
// Parsers first
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS: allow multiple localhost origins (dev + Docker)
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : [
      'http://localhost',
      'http://localhost:80',
      'http://localhost:5173',
      'http://127.0.0.1',
      'http://127.0.0.1:80',
      'http://127.0.0.1:5173',
    ];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// Explicit preflight (helps proxies) - handle all OPTIONS requests
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    } else {
      res.header('Access-Control-Allow-Origin', allowedOrigins[0]);
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    return res.status(204).send();
  }
  next();
});

// --- Log Requests ---
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// --- Test DB Connection & Log Startup ---
(async () => {
  const dbUrl = process.env.DATABASE_URL;
  const dbHost = dbUrl ? new URL(dbUrl).hostname : (process.env.DB_HOST || process.env.PGHOST || 'localhost');
  const dbUser = dbUrl ? new URL(dbUrl).username : (process.env.DB_USER || process.env.PGUSER || 'myapp_user');
  const dbName = dbUrl ? new URL(dbUrl).pathname.slice(1) : (process.env.DB_NAME || process.env.PGDATABASE || 'myapp_db');
  
  console.log(`🚀 Starting server on port ${PORT}`);
  console.log(`📊 Database: ${dbHost} | User: ${dbUser} | DB: ${dbName}`);
  
  try {
    const client = await pool.connect();
    client.release();
    console.log("✅ Database connection established");
    
    // Run database check
    const { checkDatabase } = require('./scripts/db-check');
    await checkDatabase();
  } catch (error) {
    console.error("❌ Failed to connect to the database:", error.message);
    console.error("   Please check DATABASE_URL or DB_* environment variables");
    // Don't crash - let server start, but DB calls will fail
  }
})();

// --- Health Check ---
app.get("/", (_req, res) => {
  res.json({ message: "MicroTutor API is running." });
});

app.get("/api/health", async (_req, res) => {
  try {
    // Ping Postgres
    await pool.query('SELECT 1');
    res.status(200).json({ ok: true, db: 'up' });
  } catch (error) {
    console.error('Health check DB error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// --- Routes ---
// Mount auth routes at /api/auth for new API, but keep /api/register and /api/login for backward compatibility
app.use("/api/auth", authRoutes);
app.use("/api", authRoutes); // backward compatibility: /api/register, /api/login, /api/me
app.use("/api/queries", queriesRoutes);
app.use("/api/auth", passwordResetRoutes);
app.use("/api", aiRoutes);

// --- Attach Socket.IO ---
setIO(io);

// --- Socket.IO Logic ---
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join-session", (sessionId) => {
    if (!sessionId) return;
    socket.join(sessionId);
    console.log(`User ${socket.id} joined session ${sessionId}`);
  });

  socket.on("leave-session", (sessionId) => {
    socket.leave(sessionId);
    console.log(`User ${socket.id} left session ${sessionId}`);
  });

  socket.on("session-message", (data) => {
    console.log("Session message:", data);
    io.to(data.sessionId).emit("session-message", data.message);
  });

  socket.on("whiteboard-draw", (data) => {
    console.log("📝 Whiteboard draw event:", { sessionId: data.sessionId, socketId: socket.id });
    // Convert sessionId to string to ensure consistency
    const sessionIdStr = String(data.sessionId);
    // Forward to everyone in the session room (including sender for consistency)
    io.to(sessionIdStr).emit("whiteboard-draw", data);
  });
});


// --- Start Server ---
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
