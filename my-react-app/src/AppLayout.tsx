// src/AppLayout.tsx
import React, { useEffect, useState } from "react";
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

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get("http://localhost:3000/api/me", {
          withCredentials: true,
        });
        setUser(res.data.user);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  // ✅ Define logout handler
  const handleLogout = async () => {
    try {
      await axios.post("http://localhost:3000/api/logout", {}, { withCredentials: true });
      setUser(null);
      navigate("/student/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // ✅ Use effect to safely handle redirect after loading
  useEffect(() => {
    if (!loading && !user) {
      navigate("/student/login");
    }
  }, [loading, user, navigate]);

  // ✅ Loading spinner while checking cookie
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
      {/* ---------- Header ---------- */}
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

          {user ? (
            <Box display="flex" alignItems="center" gap={2}>
              <Typography variant="body1">Hi, {user.username}</Typography>
              <Button onClick={handleLogout} variant="outlined" size="small">
                Logout
              </Button>
            </Box>
          ) : (
            <Button component={Link} to="/" variant="outlined" size="small">
              Home
            </Button>
          )}
        </Toolbar>
      </AppBar>

      {/* ---------- Main content ---------- */}
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
          <Outlet /> {/* 👈 Page content (Dashboard, etc.) */}
        </Container>
      </Box>
    </Box>
  );
}
