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

// CORS configuration - support multiple origins from env or default to localhost variants
const fallbackCorsOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
  "http://127.0.0.1",
];

const envCorsOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const hasLocalhostOrigin = envCorsOrigins.some((origin) =>
  origin.includes("localhost") || origin.includes("127.0.0.1")
);

const corsOrigins = envCorsOrigins.length
  ? Array.from(
      new Set([
        ...envCorsOrigins,
        ...(hasLocalhostOrigin ? fallbackCorsOrigins : []),
      ])
    )
  : fallbackCorsOrigins;

const io = new Server(server, {
  cors: {
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cookieParser());
app.use(express.json());

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

// --- Log Requests ---
app.use((req, _res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});

// --- Test DB Connection ---
(async () => {
  try {
    const client = await pool.connect();
    client.release();
    console.log("✅ Database connection established");
  } catch (error) {
    console.error("❌ Failed to connect to the database:", error);
  }
})();

// --- Health Check ---
app.get("/", (_req, res) => {
  res.json({ message: "MicroTutor API is running." });
});

// --- Routes ---
app.use("/api", authRoutes);
app.use("/api/queries", queriesRoutes);
app.use("/api/auth", passwordResetRoutes);
app.use("/api", aiRoutes);

const sessionRoom = (sessionId) => {
  if (sessionId === undefined || sessionId === null) return null;
  const trimmed = String(sessionId).trim();
  if (!trimmed) return null;
  return `session-${trimmed}`;
};

// --- Attach Socket.IO ---
setIO(io);

// --- Socket.IO Logic ---
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join-session", (sessionId) => {
    const room = sessionRoom(sessionId);
    if (!room) return;
    socket.join(room);
    console.log(`User ${socket.id} joined session ${room}`);
  });

  socket.on("leave-session", (sessionId) => {
    const room = sessionRoom(sessionId);
    if (!room) return;
    socket.leave(room);
    console.log(`User ${socket.id} left session ${room}`);
  });

  socket.on("session-message", (data = {}) => {
    const room = sessionRoom(data.sessionId);
    if (!room || !data.message) return;
    console.log("Session message:", { room, messageId: data.message?.id });
    io.to(room).emit("session-message", data.message);
  });

  socket.on("whiteboard-draw", (data = {}) => {
    const room = sessionRoom(data.sessionId);
    if (!room || !data.payload) return;
    socket.to(room).emit("whiteboard-draw", data);
  });

  socket.on("disconnect", (reason) => {
    console.log(`Client disconnected: ${socket.id} (${reason})`);
  });
});


// --- Start Server ---
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
