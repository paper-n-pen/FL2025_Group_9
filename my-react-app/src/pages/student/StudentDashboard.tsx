// my-react-app/src/pages/student/StudentDashboard.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
  SvgIcon,
} from "@mui/material";
import type { AlertColor, SnackbarCloseReason } from "@mui/material";
import Grid from "@mui/material/GridLegacy";
import CloseIcon from "@mui/icons-material/Close";
import {
  markActiveUserType,
  clearAuthState,
  storeAuthState,
} from "../../utils/authStorage";
import { getSocket } from "../../socket";
import { apiPath } from "../../config";
import api from "../../lib/api";
const socket = getSocket();

interface Subject {
  name: string;
  icon: string;
  subtopics: string[];
}

type Snack = {
  id: number;
  message: string;
  severity: AlertColor;
  open: boolean;
};

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedSubtopic, setSelectedSubtopic] = useState<string>("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [studentUser, setStudentUser] = useState<any>(null);
  const [acceptedTutors, setAcceptedTutors] = useState<any[]>([]);
  const [queriesWithTutors, setQueriesWithTutors] = useState<any[]>([]);
  const [snacks, setSnacks] = useState<Snack[]>([]);

  const pushSnack = (
    message: string,
    severity: AlertColor = "info"
  ) =>
    setSnacks((prevSnacks: Snack[]) => [
      ...prevSnacks,
      { id: Date.now() + Math.random(), message, severity, open: true },
    ]);

  const closeSnack = (id: number) =>
    setSnacks((prevSnacks: Snack[]) =>
      prevSnacks.map((item) =>
        item.id === id ? { ...item, open: false } : item
      )
    );

  const removeSnack = (id: number) =>
    setSnacks((prevSnacks: Snack[]) =>
      prevSnacks.filter((item) => item.id !== id)
    );

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
        const data = await api.get(apiPath("/me"));
        const fetchedUser = data?.user;
        if (!cancelled && fetchedUser) {
          const u = { ...fetchedUser, userType: fetchedUser.role || "student" };
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
      const data = await api.get(apiPath(`/queries/student/${studentUser.id}/responses`));
      const list = Array.isArray(data) ? data : [];
      
      // Keep queries grouped with their tutors (for better UI)
      setQueriesWithTutors(list);
      
      // Also maintain flattened list for backward compatibility
      const allTutors: any[] = [];
      list.forEach((query: any) => {
        if (query.tutors && Array.isArray(query.tutors)) {
          // Filter out rejected tutors from the flat list
          const pendingTutors = query.tutors.filter((t: any) => t.acceptanceStatus !== 'REJECTED');
          pendingTutors.forEach((tutor: any) => {
            allTutors.push({
              ...tutor,
              queryId: query.queryId,
              subject: query.subject,
              subtopic: query.subtopic,
              query: query.query,
              studentSelectedTutorId: query.studentSelectedTutorId
            });
          });
        }
      });
      setAcceptedTutors(allTutors);
    } catch (error) {
      console.error("Error fetching tutor responses:", error);
    }
  }, [studentUser?.id]);

  // 🔔 Socket room & real-time acceptance notification
  useEffect(() => {
    if (studentUser?.id) socket.emit("join-student-room", studentUser.id);

    const onTutorAccepted = (data: any) => {
      pushSnack(`${data.tutorName} accepted your query!`, "success");
      fetchTutorResponses();
    };

    const onTutorConfirmed = (data: any) => {
      pushSnack(`${data.tutorName} has been confirmed. Session ready to start!`, "success");
      fetchTutorResponses();
    };

    const onSessionReady = (data: any) => {
      pushSnack("Tutor has started the session! You can now enter.", "success");
      fetchTutorResponses();
    };

    socket.on("tutor-accepted-query", onTutorAccepted);
    socket.on("tutor-confirmed", onTutorConfirmed);
    socket.on("session-ready", onSessionReady);

    return () => {
      if (studentUser?.id) socket.emit("leave-student-room", studentUser.id);
      socket.off("tutor-accepted-query", onTutorAccepted);
      socket.off("tutor-confirmed", onTutorConfirmed);
      socket.off("session-ready", onSessionReady);
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
      await api.post(apiPath("/logout"), {});
    } catch (err) {
      console.error("Logout error:", err);
    }
    clearAuthState?.("student");
    setStudentUser(null);
    navigate("/student/login", { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
      const response = await api.post(apiPath("/queries/post"), {
        subject: selectedSubject,
        subtopic: selectedSubtopic,
        query: query.trim(),
        studentId: studentUser.id,
      });
      if (response?.message === "Query posted successfully") {
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

  // 🎯 Select a tutor
  const handleSelectTutor = async (queryId: string, tutorId: number, tutorName: string) => {
    try {
      if (!studentUser?.id) {
        pushSnack("Please log in again", "error");
        return;
      }
      const response = await api.post(apiPath("/queries/student/select-tutor"), {
        queryId,
        tutorId: tutorId.toString(),
        studentId: studentUser.id.toString(),
      });
      if (response?.message === "Tutor selected successfully") {
        pushSnack(`You selected ${tutorName}! Tutor can now start the session.`, "success");
        fetchTutorResponses(); // Refresh the list
      }
    } catch (error: any) {
      console.error("Error selecting tutor:", error);
      const errorMsg = error instanceof Error ? error.message : "Failed to select tutor. Please try again.";
      pushSnack(errorMsg, "error");
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
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        backgroundAttachment: "fixed",
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
                              backgroundColor: isSelected ? "primary.dark" : "background.paper",
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
                    onChange={(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                      setQuery(event.target.value)
                    }
                    multiline
                    rows={4}
                    fullWidth
                    placeholder="Explain your question in detail..."
                  />
                </Box>

                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  sx={{ 
                    background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                    borderRadius: "20px",
                    px: 3,
                    py: 1.2,
                    minWidth: "140px",
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    "&:hover": {
                      transform: "scale(1.05)",
                      boxShadow: "0 4px 12px rgba(79, 70, 229, 0.4)",
                      background: "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)",
                    },
                    "&:disabled": {
                      background: "rgba(79, 70, 229, 0.5)",
                    },
                  }}
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
                    <SvgIcon fontSize="large" viewBox="0 0 24 24">
                      <path
                        d="M12 12a5 5 0 1 0-5-5a5 5 0 0 0 5 5m0 2c-4 0-8 2-8 6h16c0-4-4-6-8-6Z"
                        fill="currentColor"
                      />
                    </SvgIcon>
                  </Avatar>
                  <Typography variant="h6">No tutor responses yet</Typography>
                  <Typography color="text.secondary">
                    Tutors will appear here when they accept your query
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={3}>
                  {queriesWithTutors.map((queryItem: any) => {
                    // Filter out rejected tutors
                    const validTutors = (queryItem.tutors || []).filter((t: any) => t.acceptanceStatus !== 'REJECTED');
                    if (validTutors.length === 0) return null;
                    
                    const isAssigned = queryItem.status === 'ASSIGNED' || queryItem.studentSelectedTutorId;
                    
                    return (
                      <Card
                        key={queryItem.queryId}
                        variant="outlined"
                        sx={{
                          borderRadius: 2,
                          backgroundColor: isAssigned 
                            ? "rgba(16, 185, 129, 0.1)" 
                            : "rgba(79, 70, 229, 0.05)",
                          border: isAssigned
                            ? "2px solid rgba(16, 185, 129, 0.3)"
                            : "1px solid rgba(79, 70, 229, 0.2)",
                        }}
                      >
                        <CardContent>
                          <Typography variant="h6" sx={{ mb: 1 }}>
                            {queryItem.subject} • {queryItem.subtopic}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: "italic" }}>
                            "{queryItem.query}"
                          </Typography>
                          {isAssigned && (
                            <Chip 
                              label="Tutor Selected" 
                              color="success" 
                              size="small" 
                              sx={{ mb: 2 }}
                            />
                          )}
                          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                            {validTutors.length} tutor{validTutors.length !== 1 ? 's' : ''} accepted:
                          </Typography>
                          <Stack spacing={1.5}>
                            {validTutors.map((tutor: any, idx: number) => {
                              const isSelected = tutor.acceptanceStatus === 'SELECTED' || queryItem.studentSelectedTutorId === tutor.tutorId?.toString();
                              const canEnter = !!tutor.sessionId && tutor.sessionStatus !== "ended";
                              const hasRating =
                                typeof tutor.tutorAverageRating === "number" &&
                                !Number.isNaN(tutor.tutorAverageRating);
                              const ratingText = hasRating
                                ? `${tutor.tutorAverageRating.toFixed?.(1) ?? tutor.tutorAverageRating}/5 (${tutor.tutorRatingsCount || 0} reviews)`
                                : "No ratings yet";
                              
                              return (
                                <Box
                                  key={`${queryItem.queryId}-${tutor.tutorId}-${idx}`}
                                  sx={{
                                    p: 1.5,
                                    borderRadius: 1,
                                    backgroundColor: isSelected 
                                      ? "rgba(16, 185, 129, 0.15)" 
                                      : "rgba(79, 70, 229, 0.08)",
                                    border: isSelected
                                      ? "1px solid rgba(16, 185, 129, 0.3)"
                                      : "1px solid rgba(79, 70, 229, 0.2)",
                                  }}
                                >
                                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                                    <Box>
                                      <Typography
                                        variant="subtitle1"
                                        color="primary"
                                        sx={{ cursor: "pointer", textDecoration: "underline", fontWeight: 600 }}
                                        onClick={() => navigate(`/tutor/${tutor.tutorId}`)}
                                      >
                                        {tutor.tutorName}
                                      </Typography>
                                      {isSelected && (
                                        <Chip 
                                          label="Selected" 
                                          color="success" 
                                          size="small" 
                                          sx={{ ml: 1 }}
                                        />
                                      )}
                                    </Box>
                                  </Box>
                                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                    <strong>Rate:</strong> {tutor.rate ? `$${tutor.rate}/10min` : "N/A"} • <strong>Rating:</strong> {ratingText}
                                  </Typography>
                                  {tutor.education && (
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                      <strong>Education:</strong> {tutor.education}
                                    </Typography>
                                  )}
                                  {tutor.bio && (
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontStyle: "italic", fontSize: "0.85rem" }}>
                                      {tutor.bio}
                                    </Typography>
                                  )}
                                  {!isSelected ? (
                                    <Button
                                      variant="contained"
                                      size="small"
                                      onClick={() => handleSelectTutor(queryItem.queryId, tutor.tutorId, tutor.tutorName)}
                                      sx={{ 
                                        background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                                        borderRadius: "12px",
                                        px: 2,
                                        py: 0.75,
                                        textTransform: "none",
                                        fontWeight: 600,
                                        fontSize: "0.875rem",
                                        mt: 1,
                                      }}
                                    >
                                      Select This Tutor
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="contained"
                                      size="small"
                                      disabled={!canEnter}
                                      onClick={() => handleStartSession(tutor)}
                                      sx={{ 
                                        background: canEnter 
                                          ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                                          : "rgba(16, 185, 129, 0.3)",
                                        borderRadius: "12px",
                                        px: 2,
                                        py: 0.75,
                                        textTransform: "none",
                                        fontWeight: 600,
                                        fontSize: "0.875rem",
                                        mt: 1,
                                      }}
                                    >
                                      {canEnter ? "Enter Session" : "Waiting for Tutor to Start..."}
                                    </Button>
                                  )}
                                </Box>
                              );
                            })}
                          </Stack>
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
      {snacks.map((snack: Snack) => (
        <Snackbar
          key={snack.id}
          open={snack.open}
          autoHideDuration={2000}
          onClose={(_event: React.SyntheticEvent | Event, reason?: SnackbarCloseReason) => {
            if (reason === "clickaway") {
              return;
            }
            closeSnack(snack.id);
          }}
          TransitionProps={{
            onExited: () => removeSnack(snack.id),
          }}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Alert
            severity={snack.severity}
            action={
              <IconButton
                size="small"
                color="inherit"
                onClick={() => closeSnack(snack.id)}
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


