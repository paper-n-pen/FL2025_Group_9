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

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cookieParser());
app.use(express.json());

// CORS configuration - support multiple origins from env or default to localhost:5173
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : ["http://localhost:5173"];

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
    // forward to everyone except sender
    socket.to(data.sessionId).emit("whiteboard-draw", data);
  });
});


// --- Start Server ---
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
