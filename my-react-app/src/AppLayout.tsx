// src/AppLayout.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  CircularProgress,
} from "@mui/material";
import { Outlet, Link, useNavigate } from "react-router-dom";
import axios from "axios";

export default function AppLayout() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const didFetch = useRef(false); // 👈 prevent Strict Mode double-fetch

  // ✅ Fetch the logged-in user via cookie (once)
  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    (async () => {
      try {
        const res = await axios.get("http://localhost:3000/api/me", {
          withCredentials: true,
        });
        console.log("Authenticated user:", res.data.user);
        setUser(res.data.user);
      } catch (err) {
        console.warn("Not authenticated:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✅ Redirect *after* a definitive check
  useEffect(() => {
    if (!loading && user === null) {
      navigate("/student/login", { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (user === null) {
    // Prevents render flicker before redirect
    return null;
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(to bottom right, #f5f7ff, #e8f0ff)",
      }}
    >
      {/* Header */}
      <AppBar
        position="static"
        elevation={0}
        color="transparent"
        sx={{
          backdropFilter: "blur(6px)",
          borderBottom: "1px solid rgba(0,0,0,0.1)",
          py: 1,
        }}
      >
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Box display="flex" alignItems="center" gap={1}>
            <Box
              sx={{
                bgcolor: "primary.main",
                color: "white",
                borderRadius: "50%",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                fontSize: 14,
              }}
            >
              MT
            </Box>
            <Typography variant="h6" fontWeight="bold">
              MicroTutor
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="body1">Hi, {user.username}</Typography>
            <Button
              onClick={async () => {
                try {
                  await axios.post(
                    "http://localhost:3000/api/logout",
                    {},
                    { withCredentials: true }
                  );
                  setUser(null);
                  navigate("/student/login", { replace: true });
                } catch (err) {
                  console.error("Logout failed:", err);
                }
              }}
              variant="outlined"
              size="small"
            >
              Logout
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main content area */}
      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          px: 2,
          py: 6,
        }}
      >
        <Container
          maxWidth={false}
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
          }}
        >
          <Outlet /> {/* 👈 Protected content renders here */}
        </Container>
      </Box>
    </Box>
  );
}
