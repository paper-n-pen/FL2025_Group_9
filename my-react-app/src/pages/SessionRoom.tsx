// src/pages/SessionRoom.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Avatar,
  Box,
  Button,
  Container,
  Divider,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import DrawIcon from "@mui/icons-material/Draw";
import axios from "axios";
import Whiteboard from "../Whiteboard";
import {
  getActiveAuthState,
  getAuthStateForType,
  markActiveUserType,
} from "../utils/authStorage";
import { getSocket, SOCKET_ENDPOINT } from "../socket";
import type { SupportedUserType } from "../utils/authStorage";

type Message = {
  id: string;
  text: string;
  sender: string;
  timestamp: string;
};

type AuthUser = {
  id: number;
  username: string;
  userType?: "student" | "tutor" | string;
};

export default function SessionRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const socket = useMemo(() => getSocket(), []);

  // Ensure the session fills the screen
  const containerMax = "xl";

  // ---------- helpers ----------
  const goBackToDashboard = useCallback(() => {
    const active = getActiveAuthState();
    const t = (user?.userType ?? active.userType) as SupportedUserType | null;
    if (t === "tutor") return navigate("/tutor/dashboard", { replace: true });
    if (t === "student") return navigate("/student/dashboard", { replace: true });
    navigate("/", { replace: true });
  }, [navigate, user?.userType]);

  const ensureUser = useCallback(async () => {
    const active = getActiveAuthState();
    if (active.user) {
      const t = (active.user.userType ?? active.userType) as SupportedUserType | null;
      if (t) markActiveUserType(t);
      setUser({ ...active.user, userType: t ?? active.user.userType });
      return true;
    }
    try {
      const { data } = await axios.get(`${SOCKET_ENDPOINT}/api/me`, {
        withCredentials: true,
      });
      if (data?.user) {
        const t = (data.user.userType as SupportedUserType) || null;
        if (t) markActiveUserType(t);
        setUser(data.user);
        return true;
      }
    } catch {}
    return false;
  }, []);

  // ---------- join/leave the session room ----------
  useEffect(() => {
    if (!sessionId) {
      navigate("/", { replace: true });
      return;
    }

    let mounted = true;
    (async () => {
      const ok = await ensureUser();
      if (!mounted) return;
      if (!ok) {
        navigate("/", { replace: true });
        return;
      }

      // Prevent duplicate listeners
      socket.removeAllListeners("connect");
      socket.removeAllListeners("session-message");
      socket.removeAllListeners("session-ended");

      const handleConnect = () => {
        console.log("🔌 Socket connected, joining session:", sessionId);
        // Ensure sessionId is a string
        const sessionIdStr = String(sessionId);
        socket.emit("join-session", sessionIdStr);
      };

      const handleIncomingMessage = (incoming: unknown) => {
        const msg = incoming as Message;
        setMessages((prev) => {
          // avoid duplicate message keys
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      };

      const handleSessionEnded = (payload: unknown) => {
        const data = payload as { sessionId: string; endedBy: string };
        if (data?.sessionId?.toString() === sessionId.toString()) {
          window.alert("Session has ended. Returning to your dashboard.");
          goBackToDashboard();
        }
      };

      socket.on("connect", handleConnect);
      socket.on("session-message", handleIncomingMessage);
      socket.on("session-ended", handleSessionEnded);

      if (socket.connected) handleConnect();

      // cleanup
      return () => {
        console.log("👋 Leaving session", sessionId);
        const sessionIdStr = String(sessionId);
        socket.emit("leave-session", sessionIdStr);
        socket.off("connect", handleConnect);
        socket.off("session-message", handleIncomingMessage);
        socket.off("session-ended", handleSessionEnded);
      };
    })();

    return () => {
      mounted = false;
    };
  }, [sessionId, socket, navigate, ensureUser, goBackToDashboard]);

  // autoscroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ---------- chat send ----------
  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !sessionId) return;

    const msg: Message = {
      id: Date.now().toString(),
      text: newMessage.trim(),
      sender: user.username,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, msg]);
    setNewMessage("");

    socket.emit("session-message", { sessionId, message: msg });
  };

  // ---------- end session ----------
  const handleEndSession = async () => {
    if (!sessionId || !user) return;
    if (!window.confirm("End this session?")) return;
    try {
      await axios.post(`${SOCKET_ENDPOINT}/api/queries/session/end`, {
        sessionId: Number(sessionId),
        endedBy: user.id,
      });
      goBackToDashboard();
    } catch (err) {
      console.error("End session failed:", err);
      window.alert("Failed to end session. Please try again.");
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        background: "linear-gradient(to bottom right, #f5f7ff, #e8f0ff)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top bar */}
      <Box sx={{ bgcolor: "white", boxShadow: 1, borderBottom: "1px solid", borderColor: "divider" }}>
        <Container
          maxWidth={containerMax}
          sx={{ py: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ bgcolor: "primary.main" }}>MT</Avatar>
            <Typography variant="h6" fontWeight="bold">
              Session Room
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="error"
            onClick={handleEndSession}
            sx={{ fontWeight: 600 }}
          >
            End Session
          </Button>
        </Container>
      </Box>

      {/* Main content */}
      <Container
        maxWidth={containerMax}
        sx={{
          flex: 1,
          py: 4,
          display: "grid",
          gap: 4,
          gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
        }}
      >
        {/* Whiteboard */}
        <Paper
          elevation={5}
          sx={{ p: 3, borderRadius: 4, display: "flex", flexDirection: "column" }}
        >
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <DrawIcon color="primary" />
            <Typography variant="h5" fontWeight="bold">
              Whiteboard
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Box flex={1} minHeight={420}>
            <Whiteboard socket={socket} sessionId={sessionId!} />
          </Box>
        </Paper>

        {/* Chat */}
        <Paper
          elevation={5}
          sx={{ p: 3, borderRadius: 4, display: "flex", flexDirection: "column" }}
        >
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <ChatBubbleOutlineIcon color="primary" />
            <Typography variant="h5" fontWeight="bold">
              Chat
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />

          <Box flex={1} overflow="auto" mb={2}>
            {messages.map((m) => {
              const own = m.sender === user?.username;
              const t = new Date(m.timestamp);
              const time = Number.isNaN(t.getTime())
                ? ""
                : t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              return (
                <Box
                  key={m.id}
                  display="flex"
                  justifyContent={own ? "flex-end" : "flex-start"}
                  mb={1}
                >
                  <Box
                    sx={{
                      px: 2,
                      py: 1,
                      borderRadius: 2,
                      bgcolor: own ? "primary.main" : "grey.200",
                      color: own ? "common.white" : "text.primary",
                      maxWidth: "80%",
                    }}
                  >
                    <Typography variant="body2">{m.text}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                      {m.sender}
                      {time ? ` • ${time}` : ""}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
            <div ref={messagesEndRef} />
          </Box>

          <Box component="form" onSubmit={sendMessage} display="flex" gap={1}>
            <TextField
              fullWidth
              size="small"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <Button variant="contained" type="submit">
              Send
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
