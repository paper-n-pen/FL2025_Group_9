// src/components/TutorNavbar.tsx
// TUTOR-SPECIFIC NAVBAR - Always reads from localStorage['tutorUser']
import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, Box, Button, Chip, Container, Typography } from "@mui/material";
import { clearAuthState, storeAuthState } from "../utils/authStorage";
import { getSocket } from "../socket";
import { apiPath } from "../config";
import api from "../lib/api";

interface TutorNavbarProps {
  onEndSessionClick?: () => void;
  showLogout?: boolean;
  showProfile?: boolean;
  showDashboard?: boolean;
  onDashboardClick?: () => void;
}

export default function TutorNavbar({
  onEndSessionClick,
  showLogout = true,
  showProfile = false,
  showDashboard = false,
  onDashboardClick,
}: TutorNavbarProps) {
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

  // Load tutor user from localStorage ONLY
  // ✅ TUTOR-SPECIFIC: Only reads from localStorage['tutorUser']
  const loadTutorUser = useCallback(async () => {
    // Force a fresh read from localStorage (don't use any cached values)
    const userJson = localStorage.getItem('tutorUser');
    
    console.log('[TUTOR NAVBAR] 🔄 Loading tutor user (FORCE REFRESH):', {
      path: location.pathname,
      storageKey: 'tutorUser',
      exists: !!userJson,
      timestamp: Date.now(),
    });
    
    if (userJson) {
      try {
        const parsedUser = JSON.parse(userJson);
        // Map tokens to coins for frontend consistency
        const userWithCoins = {
          ...parsedUser,
          coins: parsedUser.tokens ?? parsedUser.coins ?? 0,
        };
        
        // Force state update even if values appear the same
        setUser(prevUser => {
          // Always update to force re-render
          if (prevUser?.coins !== userWithCoins.coins || prevUser?.id !== userWithCoins.id) {
            console.log('[TUTOR NAVBAR] ✅ State changed, updating:', {
              oldCoins: prevUser?.coins,
              newCoins: userWithCoins.coins,
              userId: userWithCoins.id,
            });
            return userWithCoins;
          }
          // Even if same, return new object to force re-render
          console.log('[TUTOR NAVBAR] ⚠️ Same coins, but forcing update:', {
            coins: userWithCoins.coins,
            userId: userWithCoins.id,
          });
          return { ...userWithCoins };
        });
        
        console.log('[TUTOR NAVBAR] ✅ Loaded tutor:', {
          userId: userWithCoins.id,
          coins: userWithCoins.coins,
          source: 'localStorage[tutorUser]',
        });
      } catch (err) {
        console.error('[TUTOR NAVBAR] Failed to parse tutorUser:', err);
      }
    } else {
      console.warn('[TUTOR NAVBAR] ⚠️ No tutorUser in localStorage');
      // Optionally fetch from API if not in localStorage
      try {
        const resp = await api.get(apiPath('/auth/me'));
        if (resp && resp.id) {
          const userWithCoins = {
            ...resp,
            coins: resp.tokens ?? 0,
          };
          setUser(userWithCoins);
          storeAuthState('tutor', null, userWithCoins);
          console.log('[TUTOR NAVBAR] ✅ Fetched tutor from API:', {
            userId: userWithCoins.id,
            coins: userWithCoins.coins,
          });
        }
      } catch (err) {
        console.error('[TUTOR NAVBAR] Failed to fetch from API:', err);
      }
    }
  }, [location.pathname]);

  // Load on mount and location change
  useEffect(() => {
    loadTutorUser();
  }, [loadTutorUser]);

  // Listen for token updates via custom event AND storage event
  useEffect(() => {
    const handleTokenUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('[TUTOR NAVBAR] 🔔 Coin update event received:', {
        detail: customEvent.detail,
        timestamp: Date.now(),
        tutorCoins: customEvent.detail?.tutorCoins,
      });
      
      // Force reload from localStorage immediately
      loadTutorUser();
    };

    // Also listen for storage events (works across tabs/windows)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'tutorUser' && e.newValue) {
        console.log('[TUTOR NAVBAR] 🔔 Storage event received for tutorUser:', {
          oldValue: e.oldValue,
          newValue: e.newValue,
          timestamp: Date.now(),
        });
        loadTutorUser();
      }
    };

    // Use capture phase to catch events earlier
    window.addEventListener('token-update', handleTokenUpdate, true);
    window.addEventListener('storage', handleStorageChange);
    
    console.log('[TUTOR NAVBAR] 👂 Listening for token-update events (capture phase) and storage events');
    
    return () => {
      window.removeEventListener('token-update', handleTokenUpdate, true);
      window.removeEventListener('storage', handleStorageChange);
      console.log('[TUTOR NAVBAR] 🛑 Stopped listening for events');
    };
  }, [loadTutorUser]);

  // Log whenever user changes
  useEffect(() => {
    if (user) {
      console.log('[TUTOR NAVBAR] 🪙 Displaying tutor coins:', {
        userId: user.id,
        coins: user.coins,
      });
    }
  }, [user]);

  const handleLogout = useCallback(async () => {
    try {
      if (user?.id) {
        socket.emit("leave-tutor-room", user.id);
      }
      await api.post(apiPath("/logout"), {});
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      clearAuthState("tutor");
      navigate("/tutor/login", { replace: true });
    }
  }, [user, socket, navigate]);

  const handleDashboardClick = useCallback(() => {
    if (onDashboardClick) {
      onDashboardClick();
    } else {
      navigate("/tutor/dashboard", { replace: false });
    }
  }, [onDashboardClick, navigate]);

  const handleProfileClick = useCallback(() => {
    navigate("/tutor/profile", { replace: false });
  }, [navigate]);

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
          {/* 🪙 TUTOR COIN DISPLAY - Always read fresh from localStorage to ensure latest value */}
          {(() => {
            // Always read fresh from localStorage on every render to ensure we show latest coins
            const freshUserJson = localStorage.getItem('tutorUser');
            let displayCoins = user?.coins;
            
            if (freshUserJson) {
              try {
                const freshUser = JSON.parse(freshUserJson);
                displayCoins = freshUser.tokens ?? freshUser.coins ?? user?.coins;
              } catch (e) {
                // Fallback to state value
              }
            }
            
            return displayCoins !== undefined && displayCoins !== null ? (
              <Chip
                label={`🪙 ${displayCoins} Coins`}
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
            ) : null;
          })()}
          {showDashboard && (
            <Button
              variant="outlined"
              onClick={handleDashboardClick}
              disabled={location.pathname === "/tutor/dashboard"}
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
          {showProfile && (
            <Button
              variant="outlined"
              onClick={handleProfileClick}
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
              Profile
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

