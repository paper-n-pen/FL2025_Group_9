// src/pages/SessionRoom.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import type { AlertColor, SnackbarCloseReason } from "@mui/material";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import DrawIcon from "@mui/icons-material/Draw";
import CloseIcon from "@mui/icons-material/Close";
import Whiteboard from "../Whiteboard";
import {
  getActiveAuthState,
  markActiveUserType,
  storeAuthState,
} from "../utils/authStorage";
import { getSocket } from "../socket";
import { apiPath } from "../config";
import type { SupportedUserType } from "../utils/authStorage";
import api from "../lib/api";

type Message = {
  id: string;
  text: string;
  sender: string;
  timestamp: string;
};

type AuthUser = {
  id: number;
  username: string;
  name?: string;
  email?: string;
  userType: SupportedUserType;
  [key: string]: unknown;
};

type RawAuthUser = Partial<AuthUser> & {
  id?: number | string;
  role?: string | null;
  userType?: string | null;
  [key: string]: unknown;
};

const resolveUserType = (value?: string | null, fallback?: string | null): SupportedUserType => {
  const candidate = (value || fallback || "").toLowerCase();
  return candidate === "tutor" ? "tutor" : "student";
};

const normalizeAuthUser = (raw: RawAuthUser, fallbackType?: string | null): AuthUser => {
  const userType = resolveUserType(raw?.userType ?? raw?.role, fallbackType);
  const username =
    raw?.username ||
    raw?.name ||
    (typeof raw?.email === "string" ? raw.email.split("@")[0] : undefined) ||
    `user-${raw?.id ?? Date.now()}`;
  const name = raw?.name ?? raw?.username ?? username;

  return {
    ...raw,
    id: Number(raw?.id ?? 0),
    username,
    name,
    email: raw?.email,
    userType,
  };
};

type Snack = {
  id: number;
  message: string;
  severity: AlertColor;
  open: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isMessagePayload = (value: unknown): value is Message =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.text === "string" &&
  typeof value.sender === "string" &&
  typeof value.timestamp === "string";

const isSessionEndedPayload = (
  value: unknown
): value is { sessionId: string | number; endedBy: string | number } =>
  isRecord(value) &&
  (typeof value.sessionId === "string" || typeof value.sessionId === "number") &&
  (typeof value.endedBy === "string" || typeof value.endedBy === "number");

export default function SessionRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [snacks, setSnacks] = useState<Snack[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const socket = useMemo(() => getSocket(), []);
  const redirectTimeoutRef = useRef<number | null>(null);
  const snackIdRef = useRef(0);

  // Ensure the session fills the screen
  const containerMax = "xl";

  const enqueueSnack = useCallback(
    (message: string, severity: AlertColor) => {
      snackIdRef.current += 1;
      const id = snackIdRef.current;
      setSnacks((prev: Snack[]) => [...prev, { id, message, severity, open: true }]);
    },
    []
  );

  const dismissSnack = useCallback((id: number) => {
    setSnacks((prev: Snack[]) =>
      prev.map((snack) =>
        snack.id === id ? { ...snack, open: false } : snack
      )
    );
  }, []);

  const removeSnack = useCallback((id: number) => {
    setSnacks((prev: Snack[]) => prev.filter((snack) => snack.id !== id));
  }, []);

  // ---------- helpers ----------
  const goBackToDashboard = useCallback(() => {
    const active = getActiveAuthState();
    const resolved = (user?.userType ?? active.userType) as SupportedUserType | null;
    if (resolved === "tutor") return navigate("/tutor/dashboard", { replace: true });
    if (resolved === "student") return navigate("/student/dashboard", { replace: true });
    navigate("/", { replace: true });
  }, [navigate, user?.userType]);

  const scheduleRedirect = useCallback((targetPath?: string) => {
    if (redirectTimeoutRef.current) window.clearTimeout(redirectTimeoutRef.current);
    redirectTimeoutRef.current = window.setTimeout(() => {
      if (targetPath) {
        navigate(targetPath, { replace: true });
        return;
      }
      goBackToDashboard();
    }, 1200);
  }, [goBackToDashboard, navigate]);

  const ensureUser = useCallback(async () => {
    const active = getActiveAuthState();
    if (active.user) {
      const normalized = normalizeAuthUser(active.user as RawAuthUser, active.userType);
      markActiveUserType(normalized.userType);
      storeAuthState(normalized.userType, null, normalized);
      setUser(normalized);
      return true;
    }
    try {
      const data = await api.get<{ user?: RawAuthUser }>(apiPath("/me"));
      const fetchedUser = data?.user;
      if (fetchedUser) {
        const normalized = normalizeAuthUser(fetchedUser);
        markActiveUserType(normalized.userType);
        storeAuthState(normalized.userType, null, normalized);
        setUser(normalized);
        return true;
      }
    } catch (error) {
      console.error("Failed to resolve session user:", error);
    }
    return false;
  }, []);

  // ---------- join/leave the session room ----------
  useEffect(() => {
    if (!sessionId) {
      navigate("/", { replace: true });
      return;
    }

    let mounted = true;
    const handleConnect = () => {
      console.log("Joining session", sessionId);
      socket.emit("join-session", sessionId);
    };

    const handleIncomingMessage = (...args: unknown[]) => {
      const [incoming] = args;
      if (!isMessagePayload(incoming)) return;
      const sanitized: Message = {
        ...incoming,
        sender: incoming.sender || "Participant",
      };
      setMessages((prev: Message[]) => {
        if (prev.some((m) => m.id === sanitized.id)) return prev;
        return [...prev, sanitized];
      });
    };

    const handleSessionEnded = (...args: unknown[]) => {
      const [payload] = args;
      if (!sessionId || !isSessionEndedPayload(payload)) return;
      if (payload.sessionId.toString() === sessionId.toString()) {
        setConfirmOpen(false);
        setIsEnding(false);
        const isStudent = user?.userType === "student";
        const nextPath = isStudent && payload?.sessionId
          ? `/student/rate-session/${payload.sessionId}`
          : undefined;
        enqueueSnack(
          isStudent
            ? "Session has ended. Redirecting to rate your tutor..."
            : "Session has ended. Redirecting to your dashboard...",
          "info"
        );
        scheduleRedirect(nextPath);
      }
    };

    (async () => {
      const ok = await ensureUser();
      if (!mounted) return;
      if (!ok) {
        navigate("/", { replace: true });
        return;
      }

      socket.off("connect", handleConnect);
      socket.off("session-message", handleIncomingMessage);
      socket.off("session-ended", handleSessionEnded);

      socket.on("connect", handleConnect);
      socket.on("session-message", handleIncomingMessage);
      socket.on("session-ended", handleSessionEnded);

      if (socket.connected) handleConnect();
    })();

    return () => {
      mounted = false;
      console.log("Leaving session", sessionId);
      socket.emit("leave-session", sessionId);
      socket.off("connect", handleConnect);
      socket.off("session-message", handleIncomingMessage);
      socket.off("session-ended", handleSessionEnded);
    };
  }, [
    sessionId,
    socket,
    navigate,
    ensureUser,
    goBackToDashboard,
    enqueueSnack,
    scheduleRedirect,
    user?.userType,
  ]);

  // autoscroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  // ---------- chat send ----------
  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !sessionId) return;

    const senderName = user.username || user.name || "You";
    const msg: Message = {
      id: Date.now().toString(),
      text: newMessage.trim(),
      sender: senderName,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev: Message[]) => [...prev, msg]);
    setNewMessage("");

    socket.emit("session-message", { sessionId, message: msg });
  };

  // ---------- end session ----------
  const handleEndSession = () => {
    if (!sessionId) return;
    setConfirmOpen(true);
  };

  const confirmEndSession = async () => {
    if (!sessionId || !user) return;
    setIsEnding(true);
    try {
      await api.post(apiPath("/queries/session/end"), {
        sessionId: Number(sessionId),
        endedBy: user.id,
      });
      setConfirmOpen(false);
      const isStudent = user.userType === "student";
      const nextPath = isStudent ? `/student/rate-session/${sessionId}` : undefined;
      enqueueSnack(
        isStudent
          ? "Session ended successfully. Redirecting to rate your tutor..."
          : "Session ended successfully. Redirecting to your dashboard...",
        "success"
      );
      scheduleRedirect(nextPath);
    } catch (err) {
      console.error("End session failed:", err);
      enqueueSnack("Failed to end session. Please try again.", "error");
    } finally {
      setIsEnding(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        backgroundAttachment: "fixed",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top bar */}
      <Box sx={{ 
        bgcolor: "background.paper",
        backgroundImage: "linear-gradient(to bottom right, #1e293b, #0f172a)",
        boxShadow: 1, 
        borderBottom: "1px solid", 
        borderColor: "rgba(148, 163, 184, 0.2)" 
      }}>
        <Container
          maxWidth={containerMax}
          sx={{ py: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ bgcolor: "primary.main" }}>MT</Avatar>
            <Typography variant="h6" fontWeight="bold" color="text.primary">
              Session Room
            </Typography>
          </Box>
          <Button
            variant="contained"
            onClick={handleEndSession}
            sx={{
              fontWeight: 600,
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              borderRadius: "12px",
              px: 3,
              py: 1,
              textTransform: "none",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              "&:hover": {
                transform: "scale(1.05)",
                boxShadow: "0 4px 12px rgba(239, 68, 68, 0.4)",
                background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
              },
            }}
            disabled={!user}
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
            {messages.map((m: Message) => {
              const senderName = user?.username || user?.name;
              const own = senderName ? m.sender === senderName : false;
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
                      py: 1.5,
                      borderRadius: "12px",
                      background: own 
                        ? "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)"
                        : "rgba(51, 65, 85, 0.8)",
                      color: "white",
                      maxWidth: "80%",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                    }}
                  >
                    <Typography variant="body2" sx={{ color: "white", fontWeight: 500 }}>
                      {m.text}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.8)", display: "block", mt: 0.5 }}>
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewMessage(e.target.value)
              }
            />
            <Button 
              variant="contained" 
              type="submit"
              sx={{
                background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                borderRadius: "20px",
                px: 3,
                py: 1,
                minWidth: "auto",
                textTransform: "none",
                fontWeight: 600,
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                "&:hover": {
                  transform: "scale(1.05)",
                  boxShadow: "0 4px 12px rgba(79, 70, 229, 0.4)",
                  background: "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)",
                },
              }}
            >
              Send
            </Button>
          </Box>
        </Paper>
      </Container>

      <Dialog
        open={confirmOpen}
        fullWidth
        maxWidth="xs"
        disableEscapeKeyDown={isEnding}
        onClose={(event: React.SyntheticEvent, reason: "backdropClick" | "escapeKeyDown") => {
          if (isEnding) return;
          if (reason === "backdropClick") return;
          setConfirmOpen(false);
        }}
      >
        <DialogTitle>End Session</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Ending the session will remove access for both participants. Are you sure you want to
            continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={() => setConfirmOpen(false)} disabled={isEnding}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmEndSession}
            disabled={isEnding}
          >
            {isEnding ? <CircularProgress size={20} color="inherit" /> : "End Session"}
          </Button>
        </DialogActions>
      </Dialog>

      {snacks.map((snack: Snack) => (
        <Snackbar
          key={snack.id}
          open={snack.open}
          autoHideDuration={2000}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
          onClose={(
            _event: React.SyntheticEvent | Event,
            reason?: SnackbarCloseReason
          ) => {
            if (reason === "clickaway") return;
            dismissSnack(snack.id);
          }}
          TransitionProps={{
            onExited: () => removeSnack(snack.id),
          }}
        >
          <Alert
            severity={snack.severity}
            action={
              <IconButton
                size="small"
                color="inherit"
                aria-label="close"
                onClick={() => dismissSnack(snack.id)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
            sx={{ boxShadow: 3, borderRadius: 2 }}
          >
            {snack.message}
          </Alert>
        </Snackbar>
      ))}
    </Box>
  );
}
