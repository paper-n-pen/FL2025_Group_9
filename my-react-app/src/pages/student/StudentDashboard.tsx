// my-react-app/src/pages/student/StudentDashboard.tsx
// NOTE: This component contains the student "Enter Session" button
// and is responsible for calling the tokens charge-on-enter endpoint.
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
  getAuthStateForType,
} from "../../utils/authStorage";
import { getSocket } from "../../socket";
import { apiPath } from "../../config";
import api from "../../lib/api";
import axios from "axios";
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

  // 🔐 Verify session - use localStorage as PRIMARY source of truth
  // ✅ CRITICAL: Don't call /api/me if localStorage already has student data
  // This prevents cookie conflicts when multiple users are logged in
  useEffect(() => {
    let cancelled = false;
    
    // ✅ CRITICAL: Check localStorage FIRST
    const existingStudent = getAuthStateForType("student").user;
    if (existingStudent && existingStudent.id) {
      console.log('[STUDENT DASHBOARD] ✅ Using existing student from localStorage (PRIMARY SOURCE):', {
        id: existingStudent.id,
        username: existingStudent.username,
        tokens: existingStudent.tokens,
        action: 'NOT calling /api/me to avoid cookie conflicts'
      });
      
      if (!cancelled) {
        const u = { 
          ...existingStudent, 
          userType: existingStudent.userType || "student",
          username: existingStudent.username || existingStudent.name,
          tokens: existingStudent.tokens ?? 100,
          coins: existingStudent.tokens ?? existingStudent.coins ?? 100,
        };
        setStudentUser(u);
        markActiveUserType("student");
        // Don't overwrite - just use what we have
      }
      return;
    }
    
    // Only call /api/me if localStorage is completely empty (first time login)
    (async () => {
      try {
        console.log('[STUDENT DASHBOARD] No student in localStorage, calling /api/me...');
        const data = await api.get(apiPath("/me"));
        const fetchedUser = data?.user;
        if (!cancelled && fetchedUser) {
          const u = { 
            ...fetchedUser, 
            userType: fetchedUser.role || fetchedUser.userType || "student",
            username: fetchedUser.username || fetchedUser.name,
            tokens: fetchedUser.tokens ?? 100,
            coins: fetchedUser.tokens ?? 100,
          };
          setStudentUser(u);
          markActiveUserType("student");
          storeAuthState("student", null, u);
          console.log('[STUDENT DASHBOARD] ✅ Fetched student from /api/me (first time):', {
            id: u.id,
            username: u.username,
            tokens: u.tokens,
          });
        } else if (!cancelled) {
          navigate("/student/login", { replace: true });
        }
      } catch (error: any) {
        const message = String(error?.message ?? "").toLowerCase();
        const unauthorized = message.includes("401") || message.includes("unauthorized");
        if (!cancelled) {
          if (unauthorized) {
            clearAuthState("student");
            navigate("/student/login", { replace: true });
          } else {
            console.error('[STUDENT DASHBOARD] Error fetching student:', error);
            // Don't navigate on other errors - just log
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const fetchTutorResponses = useCallback(async () => {
    try {
      if (!studentUser?.id) {
        console.log('[STUDENT DASHBOARD] fetchTutorResponses: No studentUser.id, skipping');
        return;
      }
      console.log('[STUDENT DASHBOARD] fetchTutorResponses: Fetching responses for studentId:', studentUser.id);
      const data = await api.get(apiPath(`/queries/student/${studentUser.id}/responses`));
      const list = Array.isArray(data) ? data : [];
      console.log('[STUDENT DASHBOARD] fetchTutorResponses: Received', list.length, 'queries with tutors');
      
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
      console.log('[STUDENT DASHBOARD] 🔔 tutor-accepted-query event received:', data);
      pushSnack(`${data.tutorName} accepted your query!`, "success");
      // Add a small delay to ensure backend has processed the acceptance
      setTimeout(() => {
        fetchTutorResponses();
      }, 100);
    };

    const onTutorConfirmed = (data: any) => {
      pushSnack(`${data.tutorName} has been confirmed. Session ready to start!`, "success");
      fetchTutorResponses();
    };

    const onSessionReady = (data: any) => {
      pushSnack("Tutor has started the session! You can now enter.", "success");
      fetchTutorResponses();
    };

    const onSessionEnded = (data: any) => {
      console.log("Session ended, refreshing queries:", data);
      // Refresh queries to remove ended sessions
      fetchTutorResponses();
    };

    socket.on("tutor-accepted-query", onTutorAccepted);
    socket.on("tutor-confirmed", onTutorConfirmed);
    socket.on("session-ready", onSessionReady);
    socket.on("session-ended", onSessionEnded);

    return () => {
      if (studentUser?.id) socket.emit("leave-student-room", studentUser.id);
      socket.off("tutor-accepted-query", onTutorAccepted);
      socket.off("tutor-confirmed", onTutorConfirmed);
      socket.off("session-ready", onSessionReady);
      socket.off("session-ended", onSessionEnded);
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
      console.log('[STUDENT DASHBOARD] Posting query:', {
        subject: selectedSubject,
        subtopic: selectedSubtopic,
        query: query.trim(),
        studentId: studentUser.id,
        studentUser: studentUser
      });
      const response = await api.post(apiPath("/queries/post"), {
        subject: selectedSubject,
        subtopic: selectedSubtopic,
        query: query.trim(),
        studentId: studentUser.id,
      });
      console.log('[STUDENT DASHBOARD] Query post response:', response);
      if (response?.message === "Query posted successfully") {
        pushSnack("Query posted! Tutors will be notified.", "success");
        setQuery("");
        setSelectedSubject("");
        setSelectedSubtopic("");
      }
    } catch (error: any) {
      console.error('[STUDENT DASHBOARD] Error posting query:', error);
      const errorMsg = error?.response?.data?.message || error?.message || "Failed to post query. Please try again.";
      pushSnack(errorMsg, "error");
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

  // 🚀 Enter session - charges COINS BEFORE navigating
  const handleEnterSession = async (sessionId: number | string) => {
    if (!sessionId) {
      console.error('[🪙 COINS ENTER ERROR] handleEnterSession called without sessionId');
      alert('Missing session ID – cannot enter session.');
      return;
    }

    if (!studentUser?.id) {
      pushSnack("Your session expired. Please login again.", "error");
      navigate("/student/login", { replace: true });
      return;
    }

      console.log('[🪙 COINS ENTER] Student clicked Enter Session', {
        sessionId,
        currentUserId: studentUser.id,
      });

    try {
      // 1) Charge COINS on backend BEFORE entering room
      const res = await axios.post(`/api/queries/session/${sessionId}/charge-on-enter`);

      console.log(
        '[🪙 COINS ENTER] Backend /charge-on-enter response',
        res.data
      );

      if (!res.data || res.data.ok !== true) {
        console.error(
          '[🪙 COINS ENTER ERROR] Backend did not return ok=true',
          res.data
        );
        alert(res.data?.message || 'Failed to enter session (coin error)');
        return;
      }

      // ✅ STEP 2: Fetch BOTH student and tutor coins in parallel using TWO separate GET endpoints
      // This ensures both APIs are called at EXACTLY the same time
      const studentId = res.data.studentId || studentUser.id;
      const tutorId = res.data.tutorId;
      
      if (!tutorId) {
        console.error('[🪙 COINS SYNC] ❌ No tutorId in response, cannot fetch both coins');
        alert('Error: Tutor ID not found. Please try again.');
        return;
      }

      console.log('[🪙 COINS SYNC] 🚀 Calling BOTH GET endpoints in parallel:', {
        studentId,
        tutorId,
        sessionId,
      });

      // ✅ CRITICAL: Call BOTH GET endpoints in parallel using Promise.all
      const studentPath = apiPath(`/queries/session/${sessionId}/user/${studentId}/coins`);
      const tutorPath = apiPath(`/queries/session/${sessionId}/user/${tutorId}/coins`);
      
      const startTime = performance.now();
      
      // Create both fetch promises - they start IMMEDIATELY at the same time
      // Add error handling to ensure navigation happens even if coin fetching fails
      const fetchOptions = { credentials: 'include' as RequestCredentials, method: 'GET' as const };
      let studentResult: any = null;
      let tutorResult: any = null;
      
      try {
        const [studentResponse, tutorResponse] = await Promise.all([
          fetch(studentPath, fetchOptions),
          fetch(tutorPath, fetchOptions),
        ]);
        
        // Parse JSON responses
        studentResult = await studentResponse.json().catch(() => ({ ok: false }));
        tutorResult = await tutorResponse.json().catch(() => ({ ok: false }));
      } catch (fetchError) {
        console.error('[🪙 COINS SYNC] ⚠️ Error fetching coins, but continuing with navigation:', fetchError);
        // Continue with navigation even if coin fetching fails
        studentResult = { ok: false };
        tutorResult = { ok: false };
      }
      
      const endTime = performance.now();
      console.log('[🪙 COINS SYNC] ✅ Both GET endpoints completed in parallel, time:', endTime - startTime, 'ms');
      console.log('[🪙 COINS SYNC] Results:', {
        studentOk: studentResult?.ok,
        tutorOk: tutorResult?.ok,
        studentCoins: studentResult?.coins,
        tutorCoins: tutorResult?.coins,
      });

      // Update student coins from GET response
      let finalStudentCoins = studentUser.tokens || studentUser.coins || 0;
      if (studentResult && studentResult.ok && studentResult.coins !== undefined) {
        finalStudentCoins = studentResult.coins;
        const updatedStudentUser = {
          ...studentUser,
          userType: 'student',
          tokens: studentResult.coins,
          coins: studentResult.coins,
        };
        
        setStudentUser(updatedStudentUser);
        storeAuthState('student', null, updatedStudentUser);
        
        console.log('[🪙 COINS SYNC] ✅ Student coins updated from GET endpoint:', {
          studentId,
          coins: studentResult.coins,
        });
      } else {
        console.warn('[🪙 COINS SYNC] ⚠️ Student coins GET endpoint did not return valid data, using current coins:', finalStudentCoins);
      }

      // Update tutor coins from GET response
      // ⚠️ IMPORTANT: Only update tutor localStorage if that tutor is currently logged in
      // We don't want to overwrite another tutor's data
      if (tutorResult && tutorResult.ok && tutorResult.coins !== undefined && tutorId) {
        // Check if there's a tutor currently logged in
        const currentTutorUserJson = localStorage.getItem('tutorUser');
        if (currentTutorUserJson) {
          try {
            const currentTutor = JSON.parse(currentTutorUserJson);
            // Only update if this tutor is the one in the session
            if (currentTutor.id === tutorId) {
              const updatedTutor = {
                ...currentTutor,
                tokens: tutorResult.coins,
                coins: tutorResult.coins,
              };
              storeAuthState('tutor', null, updatedTutor);
              console.log('[🪙 COINS SYNC] ✅ Tutor coins updated (matched logged-in tutor):', {
                tutorId,
                coins: tutorResult.coins,
              });
            } else {
              console.log('[🪙 COINS SYNC] ⚠️ Skipping tutor coin update - different tutor logged in:', {
                sessionTutorId: tutorId,
                loggedInTutorId: currentTutor.id,
              });
            }
          } catch (e) {
            console.error('[🪙 COINS SYNC] Failed to parse current tutor user:', e);
          }
        } else {
          console.log('[🪙 COINS SYNC] ⚠️ No tutor logged in, skipping tutor coin update');
        }
      } else {
        console.warn('[🪙 COINS SYNC] ⚠️ Tutor coins GET endpoint did not return valid data');
      }

      markActiveUserType('student');  // ✅ Ensure sessionStorage is set
      
      // ✅ CRITICAL: Dispatch event IMMEDIATELY after localStorage updates
      // localStorage is synchronous, so we can dispatch right away
      // Dispatch multiple times to ensure it's caught (some browsers/tabs might miss it)
      const dispatchUpdate = () => {
        const event = new CustomEvent('token-update', { 
          detail: { 
            studentCoins: studentResult?.coins,
            tutorCoins: tutorResult?.coins,
            timestamp: Date.now(),
          } 
        });
        window.dispatchEvent(event);
        console.log('[🪙 COINS SYNC] 📢 Dispatched token-update event:', {
          studentCoins: studentResult?.coins,
          tutorCoins: tutorResult?.coins,
          timestamp: Date.now(),
        });
      };
      
      // Dispatch immediately
      dispatchUpdate();
      
      // Also dispatch after a tiny delay to catch any race conditions
      setTimeout(dispatchUpdate, 10);
      setTimeout(dispatchUpdate, 50);
      
      // Ensure both localStorage entries are updated before navigation
      console.log('[🪙 COINS SYNC] ✅ Both student and tutor coins updated simultaneously');

      // 3) Navigate to the existing session room page with UPDATED user data
      // Use the student user from state (updated from GET endpoint)
      const finalStudentUser = {
        ...studentUser,
        userType: 'student',
        tokens: finalStudentCoins,
        coins: finalStudentCoins,
      };
      
      console.log('[🪙 COINS ENTER] ✅ Preparing to navigate to session room:', {
        sessionId,
        studentId: finalStudentUser.id,
        coins: finalStudentCoins,
        userData: finalStudentUser,
      });
      
      // Navigate immediately - React Router handles state updates
      const targetPath = `/session/${sessionId}`;
      console.log('[🪙 COINS ENTER] 🚀 Calling navigate with path:', targetPath);
      
      navigate(targetPath, {
        state: { userType: "student", user: finalStudentUser },
        replace: false,
      });
      
      console.log('[🪙 COINS ENTER] ✅ Navigate function called successfully');
    } catch (err: any) {
      console.error('[🪙 COINS ENTER ERROR] Exception in handleEnterSession', err);
      console.error('[🪙 COINS ENTER ERROR] Error details:', {
        message: err?.message,
        response: err?.response?.data,
        status: err?.response?.status,
        stack: err?.stack,
      });
      
      // If backend sent 400 with INSUFFICIENT_COINS, show that
      const status = err?.response?.status;
      const data = err?.response?.data;
      
      if (status === 400) {
        if (data?.code === 'INSUFFICIENT_TOKENS' || data?.code === 'INSUFFICIENT_COINS') {
          alert(
            data?.message ||
              'You do not have enough coins to enter this session.'
          );
        } else if (data?.code === 'SESSION_NOT_FOUND') {
          alert('Session not found. Please try again.');
        } else if (data?.message) {
          alert(data.message);
        } else {
          alert('Error entering session. Please try again.');
        }
      } else if (err?.message) {
        alert(`Error: ${err.message}`);
      } else {
        alert('Error entering session. Please try again.');
      }
    }
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
        background: "linear-gradient(135deg, #37353E 0%, #44444E 50%, #37353E 100%)",
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
                    background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                    borderRadius: "14px",
                    px: 3,
                    py: 1.2,
                    alignSelf: "center",
                    width: "160px",
                    height: "40px",
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    transition: "all 0.3s ease",
                    boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: "0 8px 24px rgba(139, 92, 246, 0.4)",
                      background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                    },
                    "&:disabled": {
                      background: "rgba(139, 92, 246, 0.5)",
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
                  {[...queriesWithTutors]
                    .sort((a: any, b: any) => {
                      // Reverse chronological order (newest first)
                      // Use createdAt if available, otherwise fallback to queryId (higher ID = newer)
                      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : (Number(a.queryId) || 0);
                      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : (Number(b.queryId) || 0);
                      return dateB - dateA;
                    })
                    .map((queryItem: any) => {
                    // Filter out rejected and expired tutors (auto-remove expired)
                    const validTutors = (queryItem.tutors || []).filter((t: any) => 
                      t.acceptanceStatus !== 'REJECTED' && t.acceptanceStatus !== 'EXPIRED'
                    );
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
                            : "rgba(113, 90, 90, 0.05)",
                          border: isAssigned
                            ? "2px solid rgba(16, 185, 129, 0.3)"
                            : "1px solid rgba(113, 90, 90, 0.2)",
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
                              const averageRating = tutor.tutorAverageRating ?? 0;
                              const reviewCount = tutor.tutorRatingsCount ?? 0;
                              const ratingText = hasRating && reviewCount > 0
                                ? `${averageRating.toFixed(1)}/5 (${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'})`
                                : "No ratings yet";
                              
                              return (
                                <Box
                                  key={`${queryItem.queryId}-${tutor.tutorId}-${idx}`}
                                  sx={{
                                    p: 1.5,
                                    borderRadius: 1,
                                    backgroundColor: isSelected 
                                      ? "rgba(16, 185, 129, 0.15)" 
                                      : "rgba(113, 90, 90, 0.08)",
                                    border: isSelected
                                      ? "1px solid rgba(16, 185, 129, 0.3)"
                                      : "1px solid rgba(113, 90, 90, 0.2)",
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
                                        background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                                        transition: "all 0.3s ease",
                                        boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
                                        "&:hover": {
                                          transform: "translateY(-2px)",
                                          boxShadow: "0 8px 24px rgba(139, 92, 246, 0.4)",
                                          background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                                        },
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
                                      onClick={() => handleEnterSession(tutor.sessionId)}
                                      sx={{ 
                                        background: canEnter 
                                          ? "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"
                                          : "rgba(139, 92, 246, 0.3)",
                                        transition: "all 0.3s ease",
                                        boxShadow: canEnter ? "0 4px 12px rgba(139, 92, 246, 0.3)" : "none",
                                        "&:hover": canEnter ? {
                                          transform: "translateY(-2px)",
                                          boxShadow: "0 8px 24px rgba(139, 92, 246, 0.4)",
                                          background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                                        } : {},
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


