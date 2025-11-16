import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Rating,
  Snackbar,
  Stack,
  Typography,
  Chip,
} from "@mui/material";
import type { AlertColor } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@mui/material/IconButton";
import { apiPath } from "../../config";
import api from "../../lib/api";
import {
  getActiveAuthState,
  markActiveUserType,
  storeAuthState,
} from "../../utils/authStorage";
import type { SupportedUserType } from "../../utils/authStorage";

interface AuthUser {
  id: number;
  username: string;
  email?: string;
  userType: SupportedUserType;
  [key: string]: unknown;
}

interface SessionSummary {
  sessionId: string;
  status: string;
  rating: number | null;
  studentId: number;
  tutorId: number;
  tutorName: string;
  subject: string;
  subtopic: string;
  query: string;
  ratePer10Min: number | null;
}

const normalizeUser = (raw: any): AuthUser => {
  const userType: SupportedUserType = (raw?.userType ?? raw?.role ?? "student").toLowerCase() === "tutor"
    ? "tutor"
    : "student";
  const username =
    raw?.username ||
    raw?.name ||
    (typeof raw?.email === "string" ? raw.email.split("@")[0] : undefined) ||
    `user-${raw?.id ?? Date.now()}`;
  return {
    ...raw,
    id: Number(raw?.id ?? 0),
    username,
    email: raw?.email,
    userType,
  };
};

const gradientBg = "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)";

const RateSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [snack, setSnack] = useState<{ message: string; severity: AlertColor } | null>(null);

  const alreadyRated = useMemo(() => sessionSummary?.rating !== null, [sessionSummary?.rating]);

  const showSnack = useCallback((message: string, severity: AlertColor) => {
    setSnack({ message, severity });
  }, []);

  const resolveUser = useCallback(async () => {
    const active = getActiveAuthState();
    if (
      active.user &&
      (active.userType === "student" || active.user?.userType === "student")
    ) {
      const normalized = normalizeUser(active.user);
      markActiveUserType("student");
      storeAuthState("student", null, normalized);
      setUser(normalized);
      return normalized;
    }

    try {
      const data = await api.get(apiPath("/me"));
      const fetchedUser = data?.user;
      if (fetchedUser && (fetchedUser.role === "student" || fetchedUser.userType === "student")) {
        const normalized = normalizeUser({ ...fetchedUser, userType: "student" });
        markActiveUserType("student");
        storeAuthState("student", null, normalized);
        setUser(normalized);
        return normalized;
      }
    } catch (error) {
      console.error("Failed to resolve user for rating flow:", error);
    }

    navigate("/student/login", { replace: true });
    return null;
  }, [navigate]);

  const fetchSessionSummary = useCallback(
    async (student: AuthUser) => {
      if (!sessionId) {
        navigate("/student/dashboard", { replace: true });
        return;
      }
      setLoading(true);
      try {
        const query = `/queries/session/${sessionId}/summary?studentId=${student.id}`;
        const data = await api.get(apiPath(query));
        setSessionSummary(data as SessionSummary);
        setSelectedRating(data?.rating ?? null);
      } catch (error) {
        console.error("Failed to load session summary:", error);
        showSnack("Failed to load session information. Please return to the dashboard and try again.", "error");
      } finally {
        setLoading(false);
      }
    },
    [navigate, sessionId, showSnack]
  );

  useEffect(() => {
    (async () => {
      const resolved = await resolveUser();
      if (resolved) {
        fetchSessionSummary(resolved);
      }
    })();
  }, [fetchSessionSummary, resolveUser]);

  const handleSubmitRating = async () => {
    if (!user || !sessionSummary || !sessionId) return;
    if (!selectedRating || selectedRating < 1 || selectedRating > 5) {
      showSnack("Please select a rating between 1 and 5.", "warning");
      return;
    }

    setSubmitting(true);
    try {
      await api.post(apiPath(`/queries/session/${sessionId}/rate`), {
        studentId: user.id,
        rating: selectedRating,
      });
      setSessionSummary((prev) => (prev ? { ...prev, rating: selectedRating } : prev));
      showSnack("Thanks for your feedback! We will sync the rating with the tutor.", "success");
      setTimeout(() => {
        navigate("/student/dashboard", { replace: true });
      }, 1200);
    } catch (error) {
      console.error("Failed to submit rating:", error);
      showSnack("Failed to submit rating. Please try again later.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    navigate("/student/dashboard", { replace: true });
  };

  const renderContent = () => {
    if (loading) {
      return (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "50vh",
            gap: 2,
          }}
        >
          <CircularProgress color="secondary" />
          <Typography variant="body1" color="text.secondary">
            Loading session information for you...
          </Typography>
        </Box>
      );
    }

    if (!sessionSummary) {
      return (
        <Box textAlign="center" py={6}>
          <Typography variant="h6" mb={2}>
            Session information not found
          </Typography>
          <Button variant="contained" onClick={handleSkip}>
            Back to Dashboard
          </Button>
        </Box>
      );
    }

    return (
      <Card
        elevation={6}
        sx={{
          borderRadius: 4,
          background: "rgba(15, 23, 42, 0.8)",
          color: "white",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(99, 102, 241, 0.4)",
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h4" fontWeight={800} gutterBottom>
                Rate the Tutor
              </Typography>
              <Typography variant="body1" color="rgba(226,232,240,0.8)">
                Your feedback helps us recommend more suitable tutors for you and helps tutors continuously improve their teaching experience.
              </Typography>
            </Box>

            <Divider sx={{ borderColor: "rgba(148, 163, 184, 0.3)" }} />

            <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
              <Box flex={1}>
                <Typography variant="subtitle2" color="rgba(148,163,184,0.9)" gutterBottom>
                  Tutor
                </Typography>
                <Typography variant="h5" fontWeight={700}>
                  {sessionSummary.tutorName}
                </Typography>
                {sessionSummary.ratePer10Min ? (
                  <Typography color="rgba(148,163,184,0.9)" variant="body2" mt={0.5}>
                    Rate: ${sessionSummary.ratePer10Min}/10 minutes
                  </Typography>
                ) : null}
              </Box>
              <Box flex={1}>
                <Typography variant="subtitle2" color="rgba(148,163,184,0.9)" gutterBottom>
                  Subject
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip label={sessionSummary.subject} color="primary" variant="filled" />
                  {sessionSummary.subtopic ? (
                    <Chip label={sessionSummary.subtopic} variant="outlined" color="secondary" />
                  ) : null}
                </Stack>
              </Box>
            </Stack>

            <Box>
              <Typography variant="subtitle2" color="rgba(148,163,184,0.9)" gutterBottom>
                Your Query Summary
              </Typography>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                }}
              >
                <Typography variant="body2" color="rgba(226,232,240,0.85)">
                  {sessionSummary.query}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ borderColor: "rgba(148, 163, 184, 0.3)" }} />

            <Box textAlign="center">
              <Typography variant="subtitle1" color="rgba(226,232,240,0.9)" gutterBottom>
                How would you rate this tutoring session?
              </Typography>
              <Rating
                name="session-rating"
                value={selectedRating}
                precision={1}
                max={5}
                onChange={(_event, value) => setSelectedRating(value)}
                sx={{
                  "& .MuiRating-icon": {
                    fontSize: 48,
                  },
                  mb: 1,
                }}
                disabled={alreadyRated}
              />
              <Typography variant="body2" color="rgba(148,163,184,0.9)">
                {alreadyRated
                  ? "You have already rated, you can return to the dashboard"
                  : "Please select 1-5 stars, 5 stars means very satisfied"}
              </Typography>
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
              <Button
                variant="outlined"
                onClick={handleSkip}
                sx={{
                  borderRadius: 3,
                  textTransform: "none",
                  color: "rgba(226,232,240,0.9)",
                  borderColor: "rgba(148,163,184,0.5)",
                }}
              >
                Back to Dashboard
              </Button>
              <Button
                variant="contained"
                disabled={submitting || alreadyRated}
                onClick={handleSubmitRating}
                sx={{
                  borderRadius: 3,
                  textTransform: "none",
                  px: 4,
                  background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                  boxShadow: "0 8px 25px rgba(79, 70, 229, 0.35)",
                }}
              >
                {alreadyRated ? "Rating Submitted" : submitting ? "Submitting..." : "Submit Rating"}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        background: gradientBg,
        backgroundAttachment: "fixed",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 6,
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 900 }}>{renderContent()}</Box>

      <Snackbar
        open={!!snack}
        autoHideDuration={snack?.severity === "success" ? 1500 : 2500}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {snack
          ? (
              <Alert
                severity={snack.severity}
                action={
                  <IconButton size="small" color="inherit" onClick={() => setSnack(null)}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                }
                sx={{ boxShadow: 3, borderRadius: 2 }}
              >
                {snack.message}
              </Alert>
            )
          : undefined}
      </Snackbar>
    </Box>
  );
};

export default RateSession;
