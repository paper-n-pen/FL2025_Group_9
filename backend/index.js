// backend/index.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { Server } = require("socket.io");
const http = require("http");
require("dotenv").config();

const { pool } = require("./db");
const authRoutes = require("./routes/auth");
const { router: queriesRoutes, setIO } = require("./routes/queries");
const passwordResetRoutes = require("./routes/passwordReset");
const aiRoutes = require("./routes/ai");

const app = express();
const server = http.createServer(app);

/* -------------------- CORS ORIGINS SETUP -------------------- */

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

const hasLocalhostOrigin = envCorsOrigins.some(
  (origin) => origin.includes("localhost") || origin.includes("127.0.0.1")
);

// allow ngrok: *.ngrok-free.app, *.ngrok.app, *.ngrok.io
const ngrokPattern =
  /^https?:\/\/[a-z0-9-]+\.(ngrok(-free)?\.app|ngrok\.io|ngrok-free\.app)$/i;

const ngrokOrigins = envCorsOrigins.filter((origin) =>
  ngrokPattern.test(origin)
);

const corsOrigins = envCorsOrigins.length
  ? Array.from(
      new Set([
        ...envCorsOrigins,
        ...ngrokOrigins,
        ...(hasLocalhostOrigin ? fallbackCorsOrigins : []),
      ])
    )
  : fallbackCorsOrigins;

console.log("🌐 CORS Origins configured:", corsOrigins);

/* -------------------- SOCKET.IO SERVER -------------------- */

const io = new Server(server, {
  cors: {
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3001;

/* -------------------- EXPRESS MIDDLEWARE -------------------- */

app.use(cookieParser());
app.use(express.json());

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

// simple logger
app.use((req, _res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});

/* -------------------- DB CONNECT TEST -------------------- */

(async () => {
  try {
    const client = await pool.connect();
    client.release();
    console.log("✅ Database connection established");
  } catch (error) {
    console.error("❌ Failed to connect to the database:", error);
  }
})();

/* -------------------- HEALTH ROUTES -------------------- */

app.get("/", (_req, res) => {
  res.json({ message: "MicroTutor API is running." });
});

app.get("/api/health", async (_req, res) => {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    res.json({
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      database: "disconnected",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/* -------------------- REST ROUTES -------------------- */

app.use("/api", authRoutes);
app.use("/api/queries", queriesRoutes);
app.use("/api/auth", passwordResetRoutes);
app.use("/api", aiRoutes);

/* -------------------- HELPER: SESSION ROOM NAME -------------------- */

const sessionRoom = (sessionId) => {
  if (sessionId === undefined || sessionId === null) return null;
  const trimmed = String(sessionId).trim();
  if (!trimmed) return null;
  return `session-${trimmed}`;
};

/* -------------------- ATTACH IO TO QUERIES ROUTER -------------------- */

setIO(io);

/* -------------------- SOCKET.IO HANDLERS -------------------- */

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  /* ---- student / tutor notification rooms (for queries) ---- */

  socket.on("join-student-room", (studentId) => {
    if (!studentId) return;
    const room = `student-${studentId}`;
    socket.join(room);
    console.log(`User ${socket.id} joined student room ${room}`);
  });

  socket.on("leave-student-room", (studentId) => {
    if (!studentId) return;
    const room = `student-${studentId}`;
    socket.leave(room);
    console.log(`User ${socket.id} left student room ${room}`);
  });

  socket.on("join-tutor-room", (tutorId) => {
    if (!tutorId) return;
    const room = `tutor-${tutorId}`;
    socket.join(room);
    console.log(`User ${socket.id} joined tutor room ${room}`);
  });

  socket.on("leave-tutor-room", (tutorId) => {
    if (!tutorId) return;
    const room = `tutor-${tutorId}`;
    socket.leave(room);
    console.log(`User ${socket.id} left tutor room ${room}`);
  });

  /* ---- SESSION JOIN / LEAVE ---- */

  socket.on("join-session", async (sessionId) => {
    const room = sessionRoom(sessionId);
    if (!room) return;

    await socket.join(room);
    console.log(`[ROOM] socket ${socket.id} joined session ${room}`);

    const roomSockets = await io.in(room).fetchSockets();
    const numClients = roomSockets.length;
    const socketIds = roomSockets.map((s) => s.id).sort();

    console.log(
      `[ROOM] ${room} now has ${numClients} peers: [${socketIds.join(", ")}]`
    );

    // Jab exactly 2 peers ho, dono ko ready bhejo (caller flag ke saath)
    if (numClients === 2) {
      const callerSocketId = socketIds[0];
      console.log(
        `[ROOM] ${room} has 2 peers – ${callerSocketId} is CALLER`
      );

      roomSockets.forEach((s) => {
        const isCaller = s.id === callerSocketId;
        s.emit("ready", {
          roomId: room,
          sessionId,
          isCaller,
        });
      });
    }
  });

  socket.on("leave-session", (sessionId) => {
    const room = sessionRoom(sessionId);
    if (!room) return;
    socket.leave(room);
    console.log(`User ${socket.id} left session ${room}`);
  });

  /* ---- SESSION CHAT ---- */

  socket.on("session-message", (data = {}) => {
    const room = sessionRoom(data.sessionId);
    if (!room || !data.message) return;
    console.log("Session message:", {
      room,
      messageId: data.message?.id,
    });
    io.to(room).emit("session-message", data.message);
  });

  /* ---- WHITEBOARD ---- */

  socket.on("whiteboard-draw", (data = {}) => {
    const room = sessionRoom(data.sessionId);
    if (!room || !data.payload) return;
    socket.to(room).emit("whiteboard-draw", data);
  });

  /* ---- CAMERA / AUDIO STATE (UI sync only) ---- */

  socket.on("camera-state", (data = {}) => {
    const room = sessionRoom(data.sessionId || data.roomId);
    if (!room) return;
    console.log(
      `[SIGNAL] camera-state from ${socket.id} in ${room}:`,
      data.enabled
    );
    socket.to(room).emit("camera-state", {
      enabled: data.enabled,
      sessionId: data.sessionId || data.roomId,
    });
  });

  socket.on("audio-state", (data = {}) => {
    const room = sessionRoom(data.sessionId || data.roomId);
    if (!room) return;
    console.log(
      `[SIGNAL] audio-state from ${socket.id} in ${room}:`,
      data.enabled
    );
    socket.to(room).emit("audio-state", {
      enabled: data.enabled,
      sessionId: data.sessionId || data.roomId,
    });
  });

  /* ---- WEBRTC SIGNALING: OFFER / ANSWER / ICE / END CALL ---- */

  socket.on("video-offer", (data = {}) => {
    const room = sessionRoom(data.sessionId || data.roomId);
    if (!room || !data.offer) {
      console.log(
        `[SIGNAL ERROR] ${socket.id} → video-offer: missing room or offer`
      );
      return;
    }

    console.log(
      `[SIGNAL] forwarding video-offer from ${socket.id} in room ${room}`
    );

    socket.to(room).emit("video-offer", {
      sdp: data.offer,
      sessionId: data.sessionId || data.roomId,
      roomId: room,
    });
  });

  socket.on("video-answer", (data = {}) => {
    const room = sessionRoom(data.sessionId || data.roomId);
    if (!room || !data.answer) {
      console.log(
        `[SIGNAL ERROR] ${socket.id} → video-answer: missing room or answer`
      );
      return;
    }

    console.log(
      `[SIGNAL] forwarding video-answer from ${socket.id} in room ${room}`
    );

    socket.to(room).emit("video-answer", {
      sdp: data.answer,
      sessionId: data.sessionId || data.roomId,
      roomId: room,
    });
  });

  socket.on("ice-candidate", (data = {}) => {
    const room = sessionRoom(data.sessionId || data.roomId);
    if (!room || !data.candidate) return;

    console.log(
      `[SIGNAL] forwarding ice-candidate from ${socket.id} in room ${room}`
    );

    socket.to(room).emit("ice-candidate", {
      candidate: data.candidate,
      sessionId: data.sessionId || data.roomId,
    });
  });

  socket.on("end-call", (data = {}) => {
    const room = sessionRoom(data.sessionId || data.roomId);
    if (!room) return;
    console.log(`End call signal relayed in ${room}`);
    socket.to(room).emit("end-call", {
      sessionId: data.sessionId || data.roomId,
    });
  });

  /* ---- DISCONNECT ---- */

  socket.on("disconnect", (reason) => {
    console.log(`Client disconnected: ${socket.id} (${reason})`);
  });
});

/* -------------------- START SERVER -------------------- */

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
