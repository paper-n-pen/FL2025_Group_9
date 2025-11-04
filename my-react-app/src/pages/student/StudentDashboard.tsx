// my-react-app/src/pages/student/StudentDashboard.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Box,
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
import Grid from "@mui/material/GridLegacy";
import CloseIcon from "@mui/icons-material/Close";
import {
  markActiveUserType,
  clearAuthState,
  storeAuthState,
} from "../../utils/authStorage";
import { getSocket } from "../../socket";
import { apiPath } from "../../config";

axios.defaults.withCredentials = true;
const socket = getSocket();

interface Subject {
  name: string;
  icon: string;
  subtopics: string[];
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedSubtopic, setSelectedSubtopic] = useState<string>("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [studentUser, setStudentUser] = useState<any>(null);
  const [acceptedTutors, setAcceptedTutors] = useState<any[]>([]);
  const [snacks, setSnacks] = useState<
    { id: number; message: string; severity?: "success" | "info" | "error" }[]
  >([]);

  const pushSnack = (
    message: string,
    severity: "success" | "info" | "error" = "info"
  ) => setSnacks((prev) => [...prev, { id: Date.now(), message, severity }]);

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
    {
      name: "Math",
      icon: "📊",
      subtopics: [
        "Calculus",
        "Linear Algebra",
        "Statistics",
        "Probability",
        "Discrete Math",
        "Geometry",
      ],
    },
    {
      name: "Physics",
      icon: "⚛️",
      subtopics: [
        "Mechanics",
        "Thermodynamics",
        "Electromagnetism",
        "Quantum Physics",
        "Optics",
      ],
    },
    {
      name: "Chemistry",
      icon: "🧪",
      subtopics: [
        "Organic Chemistry",
        "Inorganic Chemistry",
        "Physical Chemistry",
        "Biochemistry",
      ],
    },
  ];

  // 🔐 Verify session, persist to authStorage so SessionRoom can resolve user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(apiPath("/me"), {
          withCredentials: true,
        });
        if (!cancelled && data?.user) {
          const u = { ...data.user, userType: "student" };
          setStudentUser(u);
          markActiveUserType("student");
          // ✅ Persist (token can be null; backend sets cookie, that's fine)
          storeAuthState("student", null, u);
        } else if (!cancelled) {
          navigate("/student/login", { replace: true });
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
        apiPath(`/queries/student/${studentUser.id}/responses`)
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

  // 🔔 Socket room & real-time acceptance notification
  useEffect(() => {
    if (studentUser?.id) socket.emit("join-student-room", studentUser.id);

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

  // 🔁 Periodically refresh responses (optional)
  useEffect(() => {
    if (!studentUser?.id) return;
    fetchTutorResponses();
    const t = setInterval(fetchTutorResponses, 5000);
    return () => clearInterval(t);
  }, [fetchTutorResponses, studentUser?.id]);

  const handleLogout = async () => {
    try {
      if (studentUser?.id) socket.emit("leave-student-room", studentUser.id);
  await axios.post(apiPath("/logout"), {});
    } catch {}
    clearAuthState?.("student");
    setStudentUser(null);
    navigate("/student/login", { replace: true });
  };

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
      const response = await axios.post(apiPath("/queries/post"), {
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
    } catch {
      pushSnack("Failed to post query. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  // 🚀 Enter session (passes user via location.state too)
  const handleStartSession = (item: any) => {
    if (!studentUser?.id) {
      pushSnack("Your session expired. Please login again.", "error");
      navigate("/student/login", { replace: true });
      return;
    }
    if (!item?.sessionId) {
      pushSnack("Your tutor hasn't started the session yet.", "info");
      return;
    }
    navigate(`/session/${item.sessionId}`, {
      state: { userType: "student", user: studentUser },
      replace: false,
    });
  };

  const currentSubject = subjects.find((s) => s.name === selectedSubject);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        alignItems: "center",
        background: "linear-gradient(to bottom right, #f5f7ff, #e8f0ff)",
        px: 4,
        py: 4,
        overflowX: "hidden",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          width: "100%",
          maxWidth: "1400px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Student Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Post your questions and get help from expert tutors
          </Typography>
        </Box>

        <Button
          variant="outlined"
          color="error"
          onClick={handleLogout}
          sx={{
            borderRadius: 2,
            fontWeight: 600,
            textTransform: "none",
            px: 3,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          Logout
        </Button>
      </Box>

      {/* Main Content */}
      <Grid
        container
        spacing={4}
        sx={{
          flexGrow: 1,
          width: "100%",
          maxWidth: "1400px",
          alignItems: "stretch",
        }}
      >
        {/* Left: Post Question */}
        <Grid item xs={12} md={6}>
          <Card elevation={4} sx={{ borderRadius: 3, height: "100%" }}>
            <CardHeader
              title="Post Your Question"
              subheader="Select a subject and describe what you need help with"
            />
            <Divider />
            <CardContent>
              <Stack component="form" spacing={3} onSubmit={handleSubmit}>
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
                            }}
                            variant="outlined"
                          >
                            <Avatar sx={{ width: 36, height: 36 }}>{s.icon}</Avatar>
                            <Typography fontWeight={600}>{s.name}</Typography>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Box>

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

        {/* Right: Tutor Responses */}
        <Grid item xs={12} md={6}>
          <Card elevation={4} sx={{ borderRadius: 3, height: "100%" }}>
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
                  <Avatar
                    sx={{
                      bgcolor: "grey.100",
                      color: "grey.500",
                      width: 56,
                      height: 56,
                    }}
                  >
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
                  {acceptedTutors.map((tutor: any, idx: number) => {
                    const canEnter = !!tutor.sessionId && tutor.sessionStatus !== "ended";
                    return (
                      <Card
                        key={tutor.queryId || idx}
                        variant="outlined"
                        sx={{
                          borderRadius: 2,
                          backgroundColor: "success.50",
                        }}
                      >
                        <CardContent>
                          <Typography variant="h6">{tutor.tutorName}</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Rate: {tutor.rate ? `$${tutor.rate}/10min` : "N/A"}
                          </Typography>
                          <Button
                            fullWidth
                            variant="contained"
                            color="success"
                            sx={{ borderRadius: 2 }}
                            disabled={!canEnter}
                            onClick={() => handleStartSession(tutor)}
                          >
                            {canEnter ? "Enter Session" : "Waiting for Tutor to Start..."}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Snackbars */}
      {snacks.map((s) => (
        <Snackbar
          key={s.id}
          open
          autoHideDuration={4000}
          onClose={() =>
            setSnacks((prev) => prev.filter((x) => x.id !== s.id))
          }
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Alert
            severity={s.severity}
            variant="filled"
            action={
              <IconButton
                size="small"
                color="inherit"
                onClick={() =>
                  setSnacks((prev) => prev.filter((x) => x.id !== s.id))
                }
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


