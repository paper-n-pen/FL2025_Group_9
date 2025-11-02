// backend/index.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { Server } = require("socket.io");
const http = require("http");
require("dotenv").config(); // ✅ loads JWT_SECRET, etc.

const { pool } = require("./db");
const authRoutes = require("./routes/auth");
const loginRoutes = require("./routes/login");
const { router: queriesRoutes, setIO } = require("./routes/queries");
const passwordResetRoutes = require("./routes/passwordReset");

// ✅ Initialize app FIRST
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // ✅ restrict origin
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
    origin: "http://localhost:5173",
    credentials: true, // ✅ required for cookies
  })
);

// Request logger
app.use((req, res, next) => {
  console.log(`Request received for: ${req.method} ${req.originalUrl}`);
  next();
});

// --- Database Connection Test ---
(async () => {
  try {
    const client = await pool.connect();
    client.release();
    console.log("✅ Database connection established");
  } catch (error) {
    console.error("❌ Failed to connect to the database:", error);
  }
})();

// --- Basic route ---
app.get("/", (req, res) => {
  res.json({
    message: "MicroTutor API Server Running",
    status: "success",
    features: ["Authentication", "Whiteboard", "Real-time Chat", "Session Management"],
  });
});

// --- API Routes ---
app.use("/api", authRoutes);
app.use("/api", loginRoutes);
app.use("/api/queries", queriesRoutes);
app.use("/api/auth", passwordResetRoutes);

// ✅ Attach Socket.IO instance to queries route
setIO(io);

// --- Socket.IO setup ---
io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("join-session", (sessionId) => {
    socket.join(`session-${sessionId}`);
    console.log(`User joined session ${sessionId}`);
  });

  socket.on("leave-session", (sessionId) => {
    socket.leave(`session-${sessionId}`);
    console.log(`User left session ${sessionId}`);
  });

  socket.on("session-message", (data) => {
    console.log("Session message:", data);
    socket.to(`session-${data.sessionId}`).emit("session-message", data.message);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

// --- Start the server ---
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
