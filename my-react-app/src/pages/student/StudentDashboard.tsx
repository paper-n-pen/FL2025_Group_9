// my-react-app/src/pages/student/StudentDashboard.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Box,
  Container,
  Grid,
  Card,
  CardHeader,
  CardContent,
  Typography,
  Button,
  Chip,
  TextField,
  Stack,
  Avatar,
  Divider,
  Snackbar,
  Alert,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { markActiveUserType, clearAuthState } from "../../utils/authStorage";
import { getSocket, SOCKET_ENDPOINT } from "../../socket";

axios.defaults.withCredentials = true;
const socket = getSocket();

interface Subject {
  name: string;
  icon: string; // using emoji for simplicity; could swap to @mui/icons-material
  subtopics: string[];
}

export default function StudentDashboard() {
  const navigate = useNavigate();

  // --- UI state ---
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedSubtopic, setSelectedSubtopic] = useState<string>("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // --- data state ---
  const [studentUser, setStudentUser] = useState<any>(null);
  const [acceptedTutors, setAcceptedTutors] = useState<any[]>([]);

  // --- notifications ---
  const [snacks, setSnacks] = useState<
    { id: number; message: string; severity?: "success" | "info" | "error" }[]
  >([]);

  const pushSnack = (message: string, severity: "success" | "info" | "error" = "info") => {
    setSnacks((prev) => [...prev, { id: Date.now(), message, severity }]);
  };

  const subjects: Subject[] = [
    {
      name: "Computer Science",
      icon: "💻",
      subtopics: [
        "Java",
        "Python",
        "JavaScript",
        "C++",
        "Data Structures",
        "Algorithms",
        "Web Development",
        "Machine Learning",
      ],
    },
    { name: "Math", icon: "📊", subtopics: ["Calculus", "Linear Algebra", "Statistics", "Probability", "Discrete Math", "Geometry"] },
    { name: "Physics", icon: "⚛️", subtopics: ["Mechanics", "Thermodynamics", "Electromagnetism", "Quantum Physics", "Optics"] },
    { name: "Chemistry", icon: "🧪", subtopics: ["Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry", "Biochemistry"] },
  ];

  // ✅ Hydrate the user from server; AppLayout already guards this route.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${SOCKET_ENDPOINT}/api/me`);
        if (!cancelled && data?.user) {
          setStudentUser(data.user);
          markActiveUserType?.("student");
        }
      } catch {
        if (!cancelled) navigate("/student/login", { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const fetchTutorResponses = useCallback(async () => {
    try {
      if (!studentUser?.id) return;
      const response = await axios.get(
        `${SOCKET_ENDPOINT}/api/queries/student/${studentUser.id}/responses`
      );
      const active = response.data.filter((item: any) => {
        const status = item?.status?.toLowerCase?.() || "";
        const sessionStatus = item?.sessionStatus?.toLowerCase?.() || "";
        return !(status === "completed" || sessionStatus === "ended");
      });
      setAcceptedTutors(active);
    } catch (error) {
      console.error("Error fetching tutor responses:", error);
    }
  }, [studentUser?.id]);

  // Socket: join room + live updates
  useEffect(() => {
    if (studentUser?.id) {
      socket.emit("join-student-room", studentUser.id);
    }

    const onAccepted = (data: any) => {
      pushSnack(`${data.tutorName} accepted your query!`, "success");
      fetchTutorResponses();
    };

    socket.on("tutor-accepted", onAccepted);

    return () => {
      if (studentUser?.id) socket.emit("leave-student-room", studentUser.id);
      socket.off("tutor-accepted", onAccepted);
    };
  }, [fetchTutorResponses, studentUser?.id]);

  useEffect(() => {
    const onSessionEnded = (payload: any) => {
      if (payload?.studentId && studentUser?.id && String(payload.studentId) !== String(studentUser.id)) {
        return;
      }
      fetchTutorResponses();
    };

    socket.on("session-ended", onSessionEnded);
    return () => {
      socket.off("session-ended", onSessionEnded);
    };
  }, [fetchTutorResponses, studentUser?.id]);

  useEffect(() => {
    fetchTutorResponses();
    const interval = setInterval(fetchTutorResponses, 5000);
    return () => clearInterval(interval);
  }, [fetchTutorResponses]);

  const currentSubject = subjects.find((s) => s.name === selectedSubject);

  // --- Handlers ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject || !selectedSubtopic || !query.trim()) {
      pushSnack("Please fill in all fields", "error");
      return;
    }
    if (!studentUser?.id) {
      pushSnack("Your session expired. Please login again.", "error");
      navigate("/student/login", { replace: true });
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${SOCKET_ENDPOINT}/api/queries/post`, {
        subject: selectedSubject,
        subtopic: selectedSubtopic,
        query: query.trim(),
        studentId: studentUser.id,
      });
      if (response.data.message === "Query posted successfully") {
        pushSnack("Query posted! Tutors will be notified.", "success");
        setQuery("");
        setSelectedSubject("");
        setSelectedSubtopic("");
      }
    } catch (error) {
      console.error("Error posting query:", error);
      pushSnack("Failed to post query. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTutor = async (t: any) => {
    try {
      let destination = t.sessionId;

      if (!destination) {
        if (!studentUser?.id) {
          pushSnack("Your session expired. Please login again.", "error");
          navigate("/student/login", { replace: true });
          return;
        }
        const response = await axios.post(`${SOCKET_ENDPOINT}/api/queries/session`, {
          queryId: t.queryId,
          tutorId: t.tutorId,
          studentId: studentUser.id,
        });
        destination = response.data.sessionId;
        if (destination) await fetchTutorResponses();
      }

      if (destination) navigate(`/session/${destination}`);
      else pushSnack("Session not ready yet. Please wait.", "info");
    } catch (error: any) {
      console.error("Error starting session:", error);
      pushSnack(
        error.response?.data?.message || error.message || "Failed to start session.",
        "error"
      );
    }
  };

  const handleLogout = async () => {
    try {
      if (studentUser?.id) socket.emit("leave-student-room", studentUser.id);
      await axios.post(`${SOCKET_ENDPOINT}/api/logout`, {});
    } catch {}
    clearAuthState?.("student");
    setStudentUser(null);
    navigate("/student/login", { replace: true });
  };

  // --- UI ---

  return (
    <Box
      sx={{
        minHeight: "100%",
        width: "100%",
      }}
    >
      {/* Page heading (AppLayout already has top app bar) */}
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
          <Box>
            <Typography variant="h4" fontWeight={800}>
              Student Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Post your questions and get help from expert tutors
            </Typography>
          </Box>
          <Button variant="outlined" size="small" onClick={handleLogout}>
            Logout
          </Button>
        </Stack>

        <Grid container spacing={3}>
          {/* Post Question */}
          <Grid item xs={12} md={6}>
            <Card elevation={3} sx={{ borderRadius: 3 }}>
              <CardHeader
                title="Post Your Question"
                subheader="Select a subject and describe what you need help with"
              />
              <Divider />
              <CardContent>
                <Stack component="form" spacing={3} onSubmit={handleSubmit}>
                  {/* Subject selection */}
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" mb={1.5}>
                      Select Subject
                    </Typography>
                    <Grid container spacing={1.5}>
                      {subjects.map((s) => {
                        const isSelected = selectedSubject === s.name;
                        return (
                          <Grid item xs={6} key={s.name}>
                            <Card
                              onClick={() => {
                                setSelectedSubject(s.name);
                                setSelectedSubtopic("");
                              }}
                              sx={{
                                cursor: "pointer",
                                borderRadius: 2,
                                p: 1.5,
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                                border: isSelected ? "2px solid" : "1px solid",
                                borderColor: isSelected ? "primary.main" : "divider",
                                backgroundColor: isSelected ? "primary.50" : "background.paper",
                                transition: "all .15s ease-in-out",
                              }}
                              variant="outlined"
                            >
                              <Avatar sx={{ width: 36, height: 36 }}>{s.icon}</Avatar>
                              <Typography fontWeight={600} sx={{ lineHeight: 1.1 }}>
                                {s.name}
                              </Typography>
                            </Card>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Box>

                  {/* Subtopic chips */}
                  {currentSubject && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" mb={1.5}>
                        Select Subtopic
                      </Typography>
                      <Stack direction="row" flexWrap="wrap" gap={1}>
                        {currentSubject.subtopics.map((st) => {
                          const selected = selectedSubtopic === st;
                          return (
                            <Chip
                              key={st}
                              label={st}
                              onClick={() => setSelectedSubtopic(st)}
                              color={selected ? "primary" : "default"}
                              variant={selected ? "filled" : "outlined"}
                              sx={{ borderRadius: 2 }}
                            />
                          );
                        })}
                      </Stack>
                    </Box>
                  )}

                  {/* Description */}
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" mb={1}>
                      Describe your question
                    </Typography>
                    <TextField
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      multiline
                      rows={4}
                      fullWidth
                      placeholder="Explain your question in detail..."
                    />
                  </Box>

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={loading}
                    sx={{ borderRadius: 2 }}
                  >
                    {loading ? "Posting..." : "Post Question"}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Tutor Responses */}
          <Grid item xs={12} md={6}>
            <Card elevation={3} sx={{ borderRadius: 3 }}>
              <CardHeader
                title="Tutor Responses"
                subheader="Tutors who accepted your query"
              />
              <Divider />
              <CardContent>
                {acceptedTutors.length === 0 ? (
                  <Box
                    sx={{
                      py: 6,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      gap: 1.5,
                    }}
                  >
                    <Avatar sx={{ bgcolor: "grey.100", color: "grey.500", width: 56, height: 56 }}>
                      {/* person icon via SVG path for no extra deps */}
                      <svg width="28" height="28" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M12 12a5 5 0 1 0-5-5a5 5 0 0 0 5 5m0 2c-4 0-8 2-8 6h16c0-4-4-6-8-6Z"
                        />
                      </svg>
                    </Avatar>
                    <Typography variant="h6">No tutor responses yet</Typography>
                    <Typography color="text.secondary">
                      Tutors will appear here when they accept your query
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {acceptedTutors.map((tutor: any, idx: number) => (
                      <Card
                        key={tutor.queryId || idx}
                        variant="outlined"
                        sx={{ borderRadius: 2, backgroundColor: "success.50" }}
                      >
                        <CardContent sx={{ pb: 1 }}>
                          <Stack spacing={0.5}>
                            <Typography variant="h6">{tutor.tutorName}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              Rate: {tutor.rate ? `$${tutor.rate}/10min` : "N/A"}
                            </Typography>
                            {tutor.bio && (
                              <Typography variant="body2" color="text.secondary">
                                {tutor.bio}
                              </Typography>
                            )}
                            {tutor.education && (
                              <Typography variant="body2" color="text.secondary">
                                Education: {tutor.education}
                              </Typography>
                            )}
                            {(tutor.subject || tutor.subtopic) && (
                              <Typography variant="caption" color="text.secondary">
                                {tutor.subject} {tutor.subtopic && `• ${tutor.subtopic}`}
                              </Typography>
                            )}
                            {tutor.query && (
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {tutor.query}
                              </Typography>
                            )}
                            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                              {tutor.status && (
                                <Chip label={`Status: ${tutor.status}`} size="small" />
                              )}
                              {tutor.sessionStatus && (
                                <Chip label={`Session: ${tutor.sessionStatus}`} size="small" />
                              )}
                            </Stack>
                          </Stack>

                          <Stack direction="row" sx={{ mt: 2 }}>
                            <Button
                              fullWidth
                              variant="contained"
                              color="success"
                              onClick={() => handleAcceptTutor(tutor)}
                              sx={{ borderRadius: 2 }}
                            >
                              Start Session with {tutor.tutorName}
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

      {/* Snackbars */}
      {snacks.map((s) => (
        <Snackbar
          key={s.id}
          open
          autoHideDuration={4000}
          onClose={() => setSnacks((prev) => prev.filter((x) => x.id !== s.id))}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Alert
            severity={s.severity}
            variant="filled"
            action={
              <IconButton
                size="small"
                aria-label="close"
                color="inherit"
                onClick={() => setSnacks((prev) => prev.filter((x) => x.id !== s.id))}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
            sx={{ boxShadow: 3, borderRadius: 2 }}
          >
            {s.message}
          </Alert>
        </Snackbar>
      ))}
    </Box>
  );
}
