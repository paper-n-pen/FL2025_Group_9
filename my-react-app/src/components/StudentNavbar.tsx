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
  const loadStudentUser = useCallback(() => {
    const userJson = localStorage.getItem('studentUser');
    
    if (userJson) {
      try {
        const parsedUser = JSON.parse(userJson);
        
        // Map tokens to coins for frontend consistency
        const userWithCoins = {
          ...parsedUser,
          coins: parsedUser.tokens ?? parsedUser.coins ?? 0,
        };
        
        // ✅ CRITICAL: Only update if user ID changed or coins changed
        // Use functional setState to compare with current state
        setUser((prevUser: any) => {
          // If same user ID and same coins, don't update (prevent infinite loop)
          if (prevUser?.id === userWithCoins.id && prevUser?.coins === userWithCoins.coins) {
            return prevUser; // Return same reference to prevent re-render
          }
          
          // ✅ CRITICAL: Check if this is a different user than what we're currently showing
          if (prevUser && prevUser.id && userWithCoins.id && prevUser.id !== userWithCoins.id) {
            console.error('[STUDENT NAVBAR] 🚨 USER ID MISMATCH - REJECTING UPDATE!', {
              currentUserId: prevUser.id,
              currentUsername: prevUser.username,
              newUserId: userWithCoins.id,
              newUsername: userWithCoins.username,
              action: 'Keeping current user data, NOT updating'
            });
            return prevUser; // Keep current user
          }
          
          return userWithCoins;
        });
      } catch (err) {
        console.error('[STUDENT NAVBAR] Failed to parse studentUser:', err);
      }
    } else {
      // Only set to null if we don't already have a user
      setUser((prevUser: any) => {
        if (!prevUser) {
          return null;
        }
        return prevUser; // Keep existing user
      });
    }
  }, [location.pathname]); // ✅ Remove user from dependencies to prevent infinite loop

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

  // Removed excessive logging to prevent console flooding

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
        backgroundImage: "linear-gradient(to bottom right, #44444E, #37353E)",
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
            {user?.username?.[0]?.toUpperCase() || user?.name?.[0]?.toUpperCase() || 'MT'}
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight="bold" color="text.primary">
              MicroTutor
            </Typography>
            {user?.username && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1 }}>
                {user.username}
              </Typography>
            )}
          </Box>
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
                background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                transition: "all 0.3s ease",
                boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: "0 8px 24px rgba(139, 92, 246, 0.4)",
                  background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                },
                borderRadius: "12px",
                px: 3,
                py: 1,
                textTransform: "none",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                "&:hover": {
                  transform: "scale(1.05)",
                  boxShadow: "0 4px 12px rgba(239, 68, 68, 0.4)",
                  background: "linear-gradient(135deg, #5a4848 0%, #b91c1c 100%)",
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

