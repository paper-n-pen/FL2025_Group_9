// src/pages/tutor/TutorDashboard.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Card,
  CardHeader,
  CardContent,
  Typography,
  Button,
  Avatar,
  Stack,
  Divider,
  Chip,
  SvgIcon,
} from "@mui/material";
import Grid from "@mui/material/GridLegacy";
import { getAuthStateForType, markActiveUserType, clearAuthState, storeAuthState } from "../../utils/authStorage";
import { getSocket } from "../../socket";
import { apiPath } from "../../config";
import api from "../../lib/api";

const socket = getSocket();

interface StudentQuery {
  id: string;
  studentId: number;
  studentName: string;
  subject: string;
  subtopic: string;
  query: string;
  timestamp: Date;
  rate: number | null;
  status?: string;
  sessionId?: string | null;
  sessionStatus?: string | null;
}

export default function TutorDashboard() {
  const [queries, setQueries] = useState<StudentQuery[]>([]);
  const [acceptedQueries, setAcceptedQueries] = useState<StudentQuery[]>([]);
  const declinedQueryIdsRef = useRef<Set<string>>(new Set());
  const [tutorUser, setTutorUser] = useState<any>(() => {
    const stored = getAuthStateForType("tutor");
    return stored.user;
  });
  const navigate = useNavigate();

  // ✅ Fetch available queries
  const fetchQueries = useCallback(async () => {
    try {
      if (!tutorUser?.id) return;
      const response = await api.get(apiPath(`/queries/tutor/${tutorUser.id}`));
      const filtered = (Array.isArray(response) ? response : []).filter(
        (item: StudentQuery) => !declinedQueryIdsRef.current.has(item.id)
      );
      setQueries(filtered);
    } catch (error) {
      console.error("Error fetching queries:", error);
    }
  }, [tutorUser?.id]);

  // ✅ Fetch accepted queries
  const fetchAcceptedQueries = useCallback(async () => {
    try {
      if (!tutorUser?.id) {
        setAcceptedQueries([]);
        return;
      }
      const response = await api.get(
        apiPath(`/queries/tutor/${tutorUser.id}/accepted-queries`)
      );
      setAcceptedQueries(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error("Error fetching accepted queries:", error);
    }
  }, [tutorUser?.id]);

  // ✅ Auth check
  useEffect(() => {
    let isMounted = true;

    const fetchTutor = async () => {
      try {
        const res = await api.get(apiPath("/me"));
        const u = res?.user;
        const resolvedRole = (u?.userType || u?.role || "").toLowerCase();

        if (resolvedRole === "tutor" && u) {
          const normalized = { ...u, userType: "tutor" };
          if (isMounted) {
            setTutorUser(normalized);
            markActiveUserType("tutor");
            storeAuthState("tutor", null, normalized);
          }
          return;
        }

        throw new Error("Tutor role not confirmed");
      } catch (error: any) {
        const cachedTutor = getAuthStateForType("tutor").user;
        const message = String(error?.message ?? "").toLowerCase();
        const unauthorized = message.includes("401") || message.includes("unauthorized");

        if (!cachedTutor || unauthorized) {
          clearAuthState("tutor");
          if (isMounted) navigate("/tutor/login", { replace: true });
          return;
        }

        console.warn("Falling back to cached tutor auth after /me failure", error);
        if (isMounted) {
          setTutorUser(cachedTutor);
          markActiveUserType("tutor");
        }
      }
    };

    fetchTutor();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  // ✅ Socket setup
  useEffect(() => {
    if (tutorUser?.id) socket.emit("join-tutor-room", tutorUser.id);

    const newQueryHandler = (query: any) => {
      console.log("New query received:", query);
      // Refresh available queries
      fetchQueries();
    };

    const queryAssignedHandler = (data: any) => {
      console.log("Query assigned to me:", data);
      // Refresh accepted queries to show "Start Session" button
      fetchAcceptedQueries();
    };

    const sessionCreatedHandler = (data: any) => {
      console.log("Session created:", data);
      // Refresh accepted queries to update session status
      fetchAcceptedQueries();
    };

    const queryNotSelectedHandler = (data: any) => {
      console.log("Query not selected (another tutor chosen):", data);
      // Remove this query from accepted queries list
      setAcceptedQueries((prev: StudentQuery[]) =>
        prev.filter((q: StudentQuery) => q.id !== data.queryId)
      );
    };

    socket.on("new-query", newQueryHandler);
    socket.on("query-assigned", queryAssignedHandler);
    socket.on("query-not-selected", queryNotSelectedHandler);
    socket.on("session-created", sessionCreatedHandler);

    return () => {
      if (tutorUser?.id) socket.emit("leave-tutor-room", tutorUser.id);
      socket.off("new-query", newQueryHandler);
      socket.off("query-assigned", queryAssignedHandler);
      socket.off("query-not-selected", queryNotSelectedHandler);
      socket.off("session-created", sessionCreatedHandler);
    };
  }, [tutorUser?.id, fetchQueries]);

  // ✅ Fetch available queries (periodic)
  useEffect(() => {
    fetchQueries();
    const interval = setInterval(fetchQueries, 5000);
    return () => clearInterval(interval);
  }, [fetchQueries]);

  // ✅ Periodic accepted query refresh
  useEffect(() => {
    if (!tutorUser?.id) return;
    fetchAcceptedQueries();
    const interval = setInterval(fetchAcceptedQueries, 5000);
    return () => clearInterval(interval);
  }, [tutorUser?.id, fetchAcceptedQueries]);

  // ✅ Query handlers
  const handleAcceptQuery = async (queryId: string) => {
    try {
      if (!tutorUser?.id) {
        navigate("/tutor/login");
        return;
      }
      const response = await api.post(apiPath("/queries/accept"), {
        queryId,
        tutorId: tutorUser.id.toString(),
      });
      if (response?.message === "Query accepted successfully" || response?.message === "Query already accepted by this tutor") {
        declinedQueryIdsRef.current.delete(queryId);
        // DON'T remove from available queries - it should stay visible to other tutors
        // Only remove it from this tutor's view if we want to hide it from "New Queries"
        // But keep it available for other tutors until student selects
        setQueries((prevQueries: StudentQuery[]) =>
          prevQueries.filter((item) => item.id !== queryId)
        );
        await fetchAcceptedQueries();
      }
    } catch (error: any) {
      console.error("Error accepting query:", error);
      alert("Failed to accept query. Please try again.");
    }
  };

  const handleDeclineQuery = async (queryId: string) => {
    try {
      if (!tutorUser?.id) return;
      await api.post(apiPath("/queries/decline"), {
        queryId,
        tutorId: tutorUser.id,
      });
      declinedQueryIdsRef.current.add(queryId);
      setQueries((prevQueries: StudentQuery[]) =>
        prevQueries.filter((item) => item.id !== queryId)
      );
    } catch (error: any) {
      console.error("Error declining query:", error);
      alert("Failed to decline query. Please try again.");
    }
  };

  const handleStartSession = async (query: StudentQuery) => {
    try {
      const response = await api.post(apiPath("/queries/session"), {
        queryId: query.id,
        tutorId: tutorUser.id,
        studentId: query.studentId,
      });
      const sessionId = response?.sessionId;
      if (sessionId) navigate(`/session/${sessionId}`);
    } catch (error: any) {
      console.error("Error starting session:", error);
      alert("Failed to start session. Please try again.");
    }
  };

  const handleLogout = useCallback(async () => {
    try {
      if (tutorUser?.id) socket.emit("leave-tutor-room", tutorUser.id);
      await api.post(apiPath("/logout"), {});
    } catch (error) {
      console.error("Tutor logout error:", error);
    } finally {
      clearAuthState("tutor");
      setTutorUser(null);
      navigate("/tutor/login", { replace: true });
    }
  }, [navigate, tutorUser?.id, socket]);

  // ✅ UI
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
        py: 6,
      }}
    >
      <Container
        maxWidth={false}
        disableGutters
        sx={{
          flexGrow: 1,
          px: { xs: 2, md: 8 },
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
        }}
      >
        {/* Header */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          mb={4}
        >
          <Box>
            <Typography variant="h4" fontWeight={800}>
              Tutor Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary">
              View student questions and manage tutoring sessions
            </Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              onClick={() => navigate("/tutor/profile")}
              sx={{ borderRadius: 2, fontWeight: 600, textTransform: "none", px: 3 }}
            >
              Profile
            </Button>

            <Button
              variant="outlined"
              color="error"
              onClick={handleLogout}
              sx={{ borderRadius: 2, fontWeight: 600, textTransform: "none", px: 3 }}
            >
              Logout
            </Button>
          </Stack>

        </Stack>

        {/* Grid */}
        <Grid container spacing={3} justifyContent="center" alignItems="flex-start">
          {/* --- New Queries --- */}
          <Grid item xs={12} md={6}>
            <Card elevation={4} sx={{ borderRadius: 3 }}>
              <CardHeader
                title="New Student Queries"
                subheader="Accept queries from students seeking help"
              />
              <Divider />
              <CardContent>
                {queries.length === 0 ? (
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
                      sx={{ bgcolor: "grey.100", color: "grey.500", width: 56, height: 56 }}
                    >
                      <SvgIcon fontSize="large" viewBox="0 0 24 24">
                        <path
                          d="M12 12a5 5 0 1 0-5-5a5 5 0 0 0 5 5m0 2c-4 0-8 2-8 6h16c0-4-4-6-8-6Z"
                          fill="currentColor"
                        />
                      </SvgIcon>
                    </Avatar>
                    <Typography variant="h6">No new queries</Typography>
                    <Typography color="text.secondary">
                      Student questions will appear here
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {queries.map((query: StudentQuery) => (
                      <Card key={query.id} variant="outlined" sx={{ borderRadius: 2 }}>
                        <CardContent>
                          <Stack spacing={0.5}>
                            <Typography variant="h6">{query.studentName}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {query.subject} • {query.subtopic}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {query.query}
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                              <Button
                                variant="contained"
                                onClick={() => handleAcceptQuery(query.id)}
                                sx={{
                                  background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                                  borderRadius: "12px",
                                  px: 3,
                                  py: 1,
                                  minWidth: "100px",
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
                                Accept
                              </Button>
                              <Button
                                variant="outlined"
                                onClick={() => handleDeclineQuery(query.id)}
                                sx={{
                                  border: "1px solid rgba(239, 68, 68, 0.5)",
                                  color: "#ef4444",
                                  borderRadius: "12px",
                                  px: 3,
                                  py: 1,
                                  minWidth: "100px",
                                  textTransform: "none",
                                  fontWeight: 600,
                                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                                  "&:hover": {
                                    transform: "scale(1.05)",
                                    borderColor: "#ef4444",
                                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                                  },
                                }}
                              >
                                Decline
                              </Button>
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* --- Accepted Queries --- */}
          <Grid item xs={12} md={6}>
            <Card elevation={4} sx={{ borderRadius: 3 }}>
              <CardHeader
                title="Accepted Queries"
                subheader="Students you’ve agreed to help"
              />
              <Divider />
              <CardContent>
                {acceptedQueries.length === 0 ? (
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
                      sx={{ bgcolor: "grey.100", color: "grey.500", width: 56, height: 56 }}
                    >
                      <SvgIcon fontSize="large" viewBox="0 0 24 24">
                        <path
                          d="M12 12a5 5 0 1 0-5-5a5 5 0 0 0 5 5m0 2c-4 0-8 2-8 6h16c0-4-4-6-8-6Z"
                          fill="currentColor"
                        />
                      </SvgIcon>
                    </Avatar>
                    <Typography variant="h6">No accepted queries</Typography>
                    <Typography color="text.secondary">
                      Accepted queries will appear here
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {acceptedQueries.map((query: any) => {
                      // Check acceptance status from the query object
                      const acceptanceStatus = (query as any).acceptanceStatus || 'PENDING';
                      const isSelected = acceptanceStatus === 'SELECTED';
                      // Allow starting session if selected and query is ASSIGNED (case-insensitive check)
                      const queryStatusUpper = (query.status || '').toUpperCase();
                      const canStartSession = isSelected && (
                        queryStatusUpper === 'ASSIGNED' || 
                        queryStatusUpper === 'ACCEPTED' || 
                        queryStatusUpper === 'IN-SESSION' ||
                        query.acceptedTutorId === tutorUser?.id?.toString()
                      );
                      const hasActiveSession = query.sessionId && query.sessionStatus !== 'ended';
                      
                      return (
                        <Card
                          key={query.id}
                          variant="outlined"
                          sx={{ 
                            borderRadius: 2, 
                            backgroundColor: isSelected 
                              ? "rgba(16, 185, 129, 0.15)"
                              : "rgba(255, 193, 7, 0.15)",
                            border: isSelected
                              ? "1px solid rgba(16, 185, 129, 0.3)"
                              : "1px solid rgba(255, 193, 7, 0.3)",
                          }}
                        >
                          <CardContent>
                            <Stack spacing={0.5}>
                              <Typography variant="h6">{query.studentName}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {query.subject} • {query.subtopic}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {query.query}
                              </Typography>
                              {acceptanceStatus === 'PENDING' && (
                                <Chip 
                                  label="Waiting for student selection" 
                                  color="warning" 
                                  size="small" 
                                  sx={{ mt: 1, alignSelf: "flex-start" }}
                                />
                              )}
                              {isSelected && (
                                <Chip 
                                  label="Student selected you!" 
                                  color="success" 
                                  size="small" 
                                  sx={{ mt: 1, alignSelf: "flex-start" }}
                                />
                              )}
                              {isSelected && canStartSession && !hasActiveSession ? (
                                <Button
                                  variant="contained"
                                  sx={{ 
                                    mt: 2,
                                    background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                                    borderRadius: "16px",
                                    px: 3,
                                    py: 1.5,
                                    minWidth: "180px",
                                    textTransform: "none",
                                    fontWeight: 600,
                                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                                    "&:hover": {
                                      transform: "scale(1.05)",
                                      boxShadow: "0 4px 12px rgba(79, 70, 229, 0.4)",
                                      background: "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)",
                                    },
                                  }}
                                  onClick={() => handleStartSession(query)}
                                >
                                  Start Session
                                </Button>
                              ) : hasActiveSession ? (
                                <Button
                                  variant="contained"
                                  disabled
                                  sx={{ 
                                    mt: 2,
                                    background: "rgba(79, 70, 229, 0.3)",
                                    borderRadius: "16px",
                                    px: 3,
                                    py: 1.5,
                                    minWidth: "180px",
                                    textTransform: "none",
                                    fontWeight: 600,
                                  }}
                                >
                                  Session Active
                                </Button>
                              ) : isSelected ? (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: "italic" }}>
                                  Ready to start session! Click "Start Session" above.
                                </Typography>
                              ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: "italic" }}>
                                  Waiting for student to select you...
                                </Typography>
                              )}
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
      </Container>
    </Box>
  );
}


