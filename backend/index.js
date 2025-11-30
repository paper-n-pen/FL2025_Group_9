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

/* -------------------- SESSION TIMER STORE -------------------- */

const sessionTimers = new Map();

function ensureSessionTimer(sessionId) {
  if (!sessionId) return null;
  const normalizedId = String(sessionId).trim();
  if (!normalizedId) return null;

  if (!sessionTimers.has(normalizedId)) {
    sessionTimers.set(normalizedId, {
      sessionId: normalizedId,
      durationMs: 10 * 60 * 1000, // 10 minutes
      remainingMs: 10 * 60 * 1000,
      status: "idle",
      blockNumber: 1,
      timerRunning: false,
      intervalId: null,
      lastTickTs: null,
      hasSessionStarted: false,
      presentSockets: new Set(),
    });
  }

  return sessionTimers.get(normalizedId);
}

/* -------------------- TIMER CONTROL HELPERS -------------------- */

function startOrResumeTimer(sessionId) {
  const state = ensureSessionTimer(sessionId);
  if (!state) return;

  // Don't start if session is ended or awaiting extension
  if (state.status === "ended" || state.status === "awaitingExtension") {
    return;
  }

  // Don't start if session hasn't been explicitly started by tutor
  if (!state.hasSessionStarted) {
    return;
  }

  // Don't start if no time remaining
  if (state.remainingMs <= 0) {
    return;
  }

  // Don't start if both student and tutor aren't present
  if (state.presentSockets.size < 2) {
    return;
  }

  // Don't start if already running
  if (state.timerRunning) {
    return;
  }

  // Start the timer
  state.status = "running";
  state.timerRunning = true;
  state.lastTickTs = Date.now();

  console.log(
    `[TIMER] Starting/Resuming timer for session ${sessionId}, block ${state.blockNumber}, remaining: ${state.remainingMs}ms, presentSockets: ${state.presentSockets.size}`
  );

  // Emit initial timer update
  const room = sessionRoom(sessionId);
  if (room) {
    io.to(room).emit("session-timer-update", {
      sessionId,
      blockNumber: state.blockNumber,
      remainingMs: state.remainingMs,
      status: state.status,
    });
  }

  state.intervalId = setInterval(() => {
    // Safety check: if timer is no longer running, clear interval
    if (!state.timerRunning || state.status === "ended") {
      if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = null;
      }
      return;
    }

    const now = Date.now();
    if (!state.lastTickTs) {
      state.lastTickTs = now;
      return;
    }

    const delta = Math.min(now - state.lastTickTs, 5000); // clamp to reasonable max
    state.remainingMs -= delta;
    if (state.remainingMs < 0) {
      state.remainingMs = 0;
    }
    state.lastTickTs = now;

    const room = sessionRoom(sessionId);
    if (room) {
      io.to(room).emit("session-timer-update", {
        sessionId,
        blockNumber: state.blockNumber,
        remainingMs: state.remainingMs,
        status: state.status,
      });
    }

    // Check if block finished
    if (state.remainingMs <= 0) {
      clearInterval(state.intervalId);
      state.intervalId = null;
      state.timerRunning = false;
      state.remainingMs = 0;
      state.status = "awaitingExtension";

      console.log(
        `[TIMER] Block ${state.blockNumber} finished for session ${sessionId}`
      );

      const room = sessionRoom(sessionId);
      if (room) {
        io.to(room).emit("session-block-ended", {
          sessionId,
          blockNumber: state.blockNumber,
        });
      }
    }
  }, 1000);
}

function pauseTimer(sessionId, reason) {
  const state = ensureSessionTimer(sessionId);
  if (!state || !state.timerRunning) return;

  // Compute final delta
  if (state.lastTickTs) {
    const now = Date.now();
    const delta = Math.min(now - state.lastTickTs, 5000);
    state.remainingMs -= delta;
    if (state.remainingMs < 0) {
      state.remainingMs = 0;
    }
    state.lastTickTs = null;
  }

  // Clear interval
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }

  state.timerRunning = false;

  if (state.status === "running") {
    state.status = "paused";
  }

  console.log(
    `[TIMER] Paused timer for session ${sessionId}, reason: ${reason}, remaining: ${state.remainingMs}ms`
  );

  const room = sessionRoom(sessionId);
  if (room) {
    io.to(room).emit("session-timer-update", {
      sessionId,
      blockNumber: state.blockNumber,
      remainingMs: state.remainingMs,
      status: state.status,
    });
  }
}

function startNewBlock(sessionId) {
  const state = ensureSessionTimer(sessionId);
  if (!state) return;

  // Reset for new block
  state.blockNumber += 1;
  state.remainingMs = state.durationMs;
  state.status = "idle"; // Set to idle first, startOrResumeTimer will set to running if it starts

  console.log(
    `[TIMER] Starting new block ${state.blockNumber} for session ${sessionId}`
  );

  // Try to start the timer (will only start if both are present)
  startOrResumeTimer(sessionId);

  const room = sessionRoom(sessionId);
  if (room) {
    io.to(room).emit("session-extension-accepted", {
      sessionId,
      blockNumber: state.blockNumber,
      remainingMs: state.remainingMs,
    });
  }
}

function hardEndSession(sessionId, reason) {
  const state = ensureSessionTimer(sessionId);
  if (!state) return;

  // Pause timer first
  pauseTimer(sessionId, reason);

  // Mark as ended
  state.status = "ended";
  state.timerRunning = false;
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }

  console.log(
    `[TIMER] Hard ended session ${sessionId}, reason: ${reason}, block: ${state.blockNumber}, remaining: ${state.remainingMs}ms`
  );

  const room = sessionRoom(sessionId);
  if (room) {
    io.to(room).emit("session-ended", {
      sessionId,
      reason: reason || "hard-end",
      blockNumber: state.blockNumber,
      remainingMs: state.remainingMs,
    });
  }
}

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

    // Track presence for timer
    const state = ensureSessionTimer(sessionId);
    if (state) {
      // Clean up any stale socket IDs that are no longer in the room
      const actualSocketIds = new Set(socketIds);
      for (const sid of state.presentSockets) {
        if (!actualSocketIds.has(sid)) {
          state.presentSockets.delete(sid);
          console.log(`[TIMER] Cleaned up stale socket ${sid} from session ${sessionId}`);
        }
      }
      
      state.presentSockets.add(socket.id);
      socket.data.sessionId = sessionId; // store for disconnect
      
      console.log(
        `[TIMER] Session ${sessionId} now has ${state.presentSockets.size} present sockets, hasStarted: ${state.hasSessionStarted}, status: ${state.status}`
      );
    }

    // Try to start/resume timer if conditions are met
    if (state) {
      startOrResumeTimer(sessionId);
    }

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

    // Update presence for timer
    const state = ensureSessionTimer(sessionId);
    if (state) {
      state.presentSockets.delete(socket.id);
      // Pause timer if less than 2 people in room
      if (state.timerRunning && state.presentSockets.size < 2) {
        pauseTimer(sessionId, "peer-left");
      }
    }
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

    // Handle timer presence on disconnect
    if (socket.data.sessionId) {
      const sessionId = socket.data.sessionId;
      const state = ensureSessionTimer(sessionId);
      if (state) {
        state.presentSockets.delete(socket.id);
        // Pause timer if less than 2 people in room
        if (state.timerRunning && state.presentSockets.size < 2) {
          pauseTimer(sessionId, "disconnect");
        }
      }
    }
  });

  /* ---- SESSION TIMER CONTROL EVENTS ---- */

  socket.on("session-start", ({ sessionId, role }) => {
    const state = ensureSessionTimer(sessionId);
    if (!state) return;

    if (state.status === "ended") {
      console.log(
        `[TIMER] Session already ended, ignoring session-start for ${sessionId}`
      );
      return;
    }

    // Mark session as started
    state.hasSessionStarted = true;

    console.log(
      `[TIMER] Session-start received for ${sessionId}, role: ${role}`
    );

    // Try starting immediately if both are present
    startOrResumeTimer(sessionId);

    // Notify both sides that session is considered started
    const room = sessionRoom(sessionId);
    if (room) {
      io.to(room).emit("session-started", {
        sessionId,
        blockNumber: state.blockNumber,
        remainingMs: state.remainingMs,
        status: state.status,
      });
    }
  });

  socket.on("session-hard-end", ({ sessionId, reason }) => {
    console.log(
      `[TIMER] Hard end requested for ${sessionId}, reason: ${reason}`
    );
    hardEndSession(sessionId, reason || "manual-hard-end");
  });

  socket.on("session-extension-request", ({ sessionId }) => {
    const state = ensureSessionTimer(sessionId);
    if (!state) return;

    if (state.status !== "awaitingExtension") {
      console.log(
        `[TIMER] Ignoring extension request; invalid state for ${sessionId}, status: ${state.status}`
      );
      return;
    }

    const room = sessionRoom(sessionId);
    if (!room) return;

    console.log(
      `[TIMER] Extension request for ${sessionId}, block ${state.blockNumber}`
    );

    // Broadcast to room; frontend will show prompt only on tutor side
    io.to(room).emit("session-extension-request", {
      sessionId,
      blockNumber: state.blockNumber,
    });
  });

  socket.on("session-extension-response", ({ sessionId, accepted }) => {
    const state = ensureSessionTimer(sessionId);
    if (!state) return;

    if (state.status !== "awaitingExtension") {
      console.log(
        `[TIMER] Ignoring extension response; invalid state for ${sessionId}, status: ${state.status}`
      );
      return;
    }

    const room = sessionRoom(sessionId);
    if (!room) return;

    if (accepted) {
      console.log(`[TIMER] Extension ACCEPTED for ${sessionId}`);
      startNewBlock(sessionId);
    } else {
      console.log(`[TIMER] Extension DECLINED for ${sessionId}`);
      hardEndSession(sessionId, "extension-declined");
    }
  });
});

/* -------------------- START SERVER -------------------- */

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
