// src/components/StudentNavbar.tsx
// STUDENT-SPECIFIC NAVBAR - Always reads from localStorage['studentUser']
import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, Box, Button, Chip, Container, Typography } from "@mui/material";
import { clearAuthState, storeAuthState } from "../utils/authStorage";
import { getSocket } from "../socket";
import { apiPath } from "../config";
import api from "../lib/api";

interface StudentNavbarProps {
  onEndSessionClick?: () => void;
  showLogout?: boolean;
  showDashboard?: boolean;
  onDashboardClick?: () => void;
}

export default function StudentNavbar({
  onEndSessionClick,
  showLogout = true,
  showDashboard = false,
  onDashboardClick,
}: StudentNavbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const socket = getSocket();

  // Check if we should hide navbar
  const hideNavbar = 
    location.pathname === "/" ||
    location.pathname.startsWith("/student/login") ||
    location.pathname.startsWith("/student/register") ||
    location.pathname.startsWith("/tutor/login") ||
    location.pathname.startsWith("/tutor/setup");

  // Load student user from localStorage ONLY
  // ✅ STUDENT-SPECIFIC: Only reads from localStorage['studentUser']
  const loadStudentUser = useCallback(async () => {
    const userJson = localStorage.getItem('studentUser');
    
    console.log('[STUDENT NAVBAR] 🔄 Loading student user:', {
      path: location.pathname,
      storageKey: 'studentUser',
      exists: !!userJson,
    });
    
    if (userJson) {
      try {
        const parsedUser = JSON.parse(userJson);
        // Map tokens to coins for frontend consistency
        const userWithCoins = {
          ...parsedUser,
          coins: parsedUser.tokens ?? parsedUser.coins ?? 0,
        };
        setUser(userWithCoins);
        console.log('[STUDENT NAVBAR] ✅ Loaded student:', {
          userId: userWithCoins.id,
          coins: userWithCoins.coins,
          source: 'localStorage[studentUser]',
        });
      } catch (err) {
        console.error('[STUDENT NAVBAR] Failed to parse studentUser:', err);
      }
    } else {
      console.warn('[STUDENT NAVBAR] ⚠️ No studentUser in localStorage');
      // Optionally fetch from API if not in localStorage
      try {
        const resp = await api.get(apiPath('/auth/me'));
        if (resp && resp.id) {
          const userWithCoins = {
            ...resp,
            coins: resp.tokens ?? 0,
          };
          setUser(userWithCoins);
          storeAuthState('student', null, userWithCoins);
          console.log('[STUDENT NAVBAR] ✅ Fetched student from API:', {
            userId: userWithCoins.id,
            coins: userWithCoins.coins,
          });
        }
      } catch (err) {
        console.error('[STUDENT NAVBAR] Failed to fetch from API:', err);
      }
    }
  }, [location.pathname]);

  // Load on mount and location change
  useEffect(() => {
    loadStudentUser();
  }, [loadStudentUser]);

  // Listen for token updates
  useEffect(() => {
    const handleTokenUpdate = () => {
      console.log('[STUDENT NAVBAR] 🔔 Coin update event received, reloading...');
      loadStudentUser();
    };

    window.addEventListener('token-update', handleTokenUpdate);
    return () => {
      window.removeEventListener('token-update', handleTokenUpdate);
    };
  }, [loadStudentUser]);

  // Log whenever user changes
  useEffect(() => {
    if (user) {
      console.log('[STUDENT NAVBAR] 🪙 Displaying student coins:', {
        userId: user.id,
        coins: user.coins,
      });
    }
  }, [user]);

  const handleLogout = useCallback(async () => {
    try {
      if (user?.id) {
        socket.emit("leave-student-room", user.id);
      }
      await api.post(apiPath("/logout"), {});
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      clearAuthState("student");
      navigate("/student/login", { replace: true });
    }
  }, [user, socket, navigate]);

  const handleDashboardClick = useCallback(() => {
    if (onDashboardClick) {
      onDashboardClick();
    } else {
      navigate("/student/dashboard", { replace: false });
    }
  }, [onDashboardClick, navigate]);

  if (hideNavbar) {
    return null;
  }

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        backgroundImage: "linear-gradient(to bottom right, #1e293b, #0f172a)",
        boxShadow: 1,
        borderBottom: "1px solid",
        borderColor: "rgba(148, 163, 184, 0.2)",
        position: "sticky",
        top: 0,
        zIndex: 1000,
      }}
    >
      <Container
        maxWidth="xl"
        sx={{
          py: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar 
            sx={{ bgcolor: "primary.main", cursor: "pointer" }} 
            onClick={handleDashboardClick}
          >
            MT
          </Avatar>
          <Typography variant="h6" fontWeight="bold" color="text.primary">
            MicroTutor
          </Typography>
        </Box>

        <Box display="flex" gap={1} alignItems="center">
          {/* 🪙 STUDENT COIN DISPLAY - Only from localStorage['studentUser'] */}
          {user && (user.coins !== undefined && user.coins !== null) && (
            <Chip
              label={`🪙 ${user.coins} Coins`}
              sx={{
                fontWeight: 600,
                bgcolor: "rgba(251, 191, 36, 0.15)",
                border: "1px solid rgba(251, 191, 36, 0.3)",
                color: "rgba(251, 191, 36, 1)",
                fontSize: "0.9rem",
                "& .MuiChip-label": {
                  px: 1.5,
                },
              }}
            />
          )}
          {showDashboard && (
            <Button
              variant="outlined"
              onClick={handleDashboardClick}
              disabled={location.pathname === "/student/dashboard"}
              sx={{
                fontWeight: 600,
                borderRadius: "12px",
                px: 3,
                py: 1,
                textTransform: "none",
                borderColor: "rgba(148, 163, 184, 0.3)",
                color: "text.primary",
                "&:hover": {
                  borderColor: "rgba(148, 163, 184, 0.5)",
                  bgcolor: "rgba(148, 163, 184, 0.1)",
                },
                "&:disabled": {
                  borderColor: "rgba(148, 163, 184, 0.2)",
                  color: "text.secondary",
                },
              }}
            >
              Dashboard
            </Button>
          )}
          {onEndSessionClick && (
            <Button
              variant="contained"
              onClick={onEndSessionClick}
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
            >
              End Session
            </Button>
          )}
          {showLogout && (
            <Button
              variant="outlined"
              onClick={handleLogout}
              sx={{
                fontWeight: 600,
                borderRadius: "12px",
                px: 3,
                py: 1,
                textTransform: "none",
                borderColor: "rgba(148, 163, 184, 0.3)",
                color: "text.primary",
                "&:hover": {
                  borderColor: "rgba(148, 163, 184, 0.5)",
                  bgcolor: "rgba(148, 163, 184, 0.1)",
                },
              }}
            >
              Logout
            </Button>
          )}
        </Box>
      </Container>
    </Box>
  );
}

