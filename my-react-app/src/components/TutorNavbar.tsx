// src/components/TutorNavbar.tsx
// TUTOR-SPECIFIC NAVBAR - Always reads from localStorage['tutorUser']
import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, Box, Button, Chip, Container, Typography } from "@mui/material";
import { clearAuthState, clearAllAuthStates, storeAuthState, getAuthStateForType } from "../utils/authStorage";
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

  // Load tutor user - prioritize sessionStorage (tab-specific) over localStorage
  // ✅ CRITICAL: Check sessionStorage FIRST to get the correct tutor ID for this tab
  const loadTutorUser = useCallback(() => {
    // ✅ CRITICAL: Check sessionStorage FIRST (tab-specific, never cleared by other tabs)
    const tabTutorId = sessionStorage.getItem('tabTutorId');
    const tabTutorData = sessionStorage.getItem('tabTutorData');
    
    if (tabTutorId && tabTutorData) {
      try {
        const parsedTutor = JSON.parse(tabTutorData);
        if (parsedTutor && parsedTutor.id && parsedTutor.id.toString() === tabTutorId) {
          // ✅ CRITICAL: If localStorage has a different user ID, clear it and use sessionStorage
          const tutorUserJson = localStorage.getItem('tutorUser');
          if (tutorUserJson) {
            try {
              const localStorageTutor = JSON.parse(tutorUserJson);
              if (localStorageTutor.id && localStorageTutor.id !== parsedTutor.id) {
                console.warn('[TUTOR NAVBAR] 🚨 localStorage has different user ID, clearing it:', {
                  localStorageId: localStorageTutor.id,
                  sessionStorageId: parsedTutor.id,
                  action: 'Clearing localStorage and using sessionStorage data'
                });
                localStorage.removeItem('tutorUser');
              }
            } catch (e) {
              // If parsing fails, clear localStorage
              localStorage.removeItem('tutorUser');
            }
          }
          
          // Map tokens to coins for frontend consistency
          const userWithCoins = {
            ...parsedTutor,
            coins: parsedTutor.tokens ?? parsedTutor.coins ?? 0,
          };
          
          setUser((prevUser: any) => {
            // Always update if coins changed or user ID changed
            if (prevUser?.id === userWithCoins.id && prevUser?.coins === userWithCoins.coins) {
              return prevUser; // Return same reference to prevent re-render
            }
            
            console.log('[TUTOR NAVBAR] ✅ Updating tutor user from sessionStorage:', {
              userId: userWithCoins.id,
              oldCoins: prevUser?.coins,
              newCoins: userWithCoins.coins,
            });
            
            return userWithCoins;
          });
          return; // Exit early - don't check localStorage
        }
      } catch (e) {
        // If parsing fails, fall through to localStorage
      }
    }
    
    // Fallback to localStorage if sessionStorage doesn't have it
    const userJson = localStorage.getItem('tutorUser');
    
    if (userJson) {
      try {
        const parsedUser = JSON.parse(userJson);
        
        // Map tokens to coins for frontend consistency
        const userWithCoins = {
          ...parsedUser,
          coins: parsedUser.tokens ?? parsedUser.coins ?? 0,
        };
        
        // ✅ CRITICAL: Always update if coins changed (even if user ID is same)
        // Use functional setState to compare with current state
        setUser((prevUser: any) => {
          // ✅ CRITICAL: Check if this is a different user than what we're currently showing
          if (prevUser && prevUser.id && userWithCoins.id && prevUser.id !== userWithCoins.id) {
            console.error('[TUTOR NAVBAR] 🚨 USER ID MISMATCH - REJECTING UPDATE!', {
              currentUserId: prevUser.id,
              currentUsername: prevUser.username,
              newUserId: userWithCoins.id,
              newUsername: userWithCoins.username,
              action: 'Keeping current user data, NOT updating'
            });
            return prevUser; // Keep current user
          }
          
          // ✅ CRITICAL: Always update if coins changed (for session end scenarios)
          // This ensures coins are updated even if user ID is the same
          if (prevUser?.id === userWithCoins.id && prevUser?.coins === userWithCoins.coins) {
            // Only skip update if coins are truly the same
            return prevUser; // Return same reference to prevent re-render
          }
          
          console.log('[TUTOR NAVBAR] ✅ Updating tutor user from localStorage:', {
            userId: userWithCoins.id,
            oldCoins: prevUser?.coins,
            newCoins: userWithCoins.coins,
          });
          
          return userWithCoins;
        });
      } catch (err) {
        console.error('[TUTOR NAVBAR] Failed to parse tutorUser:', err);
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
    loadTutorUser();
  }, [loadTutorUser]);

  // Listen for token updates via custom event AND storage event
  useEffect(() => {
    const handleTokenUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('[TUTOR NAVBAR] 🔔 Token update event received:', customEvent.detail);
      
      // Get current user from state at the time of event
      const currentUserJson = localStorage.getItem('tutorUser');
      const eventUserId = customEvent.detail?.userId;
      const eventTutorCoins = customEvent.detail?.tutorCoins;
      
      if (currentUserJson) {
        try {
          const currentUser = JSON.parse(currentUserJson);
          
          // ✅ CRITICAL: Always reload if tutorCoins are in the event (session started scenario)
          if (eventTutorCoins !== undefined && eventTutorCoins !== null) {
            console.log('[TUTOR NAVBAR] 🔔 Token update event with tutorCoins, forcing reload:', {
              eventTutorCoins,
              currentUserId: currentUser?.id,
              eventUserId,
            });
            loadTutorUser();
            return;
          }
          
          // Only reload if the event is for the current user or no userId specified
          if (eventUserId && currentUser?.id && eventUserId !== currentUser.id) {
            console.log('[TUTOR NAVBAR] ⚠️ Ignoring event - different user:', {
              eventUserId,
              currentUserId: currentUser.id,
            });
            return; // Ignore events for other users
          }
        } catch (e) {
          console.error('[TUTOR NAVBAR] Error parsing currentUser:', e);
          // If parsing fails, just reload
        }
      }
      
      console.log('[TUTOR NAVBAR] 🔄 Reloading tutor user from storage');
      loadTutorUser();
    };

    // Also listen for storage events (works across tabs/windows)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'tutorUser' && e.newValue) {
        try {
          const newUser = JSON.parse(e.newValue);
          // Read current user from localStorage to avoid stale closure
          const currentUserJson = localStorage.getItem('tutorUser');
          if (currentUserJson) {
            try {
              const currentUser = JSON.parse(currentUserJson);
              // ✅ CRITICAL: Only reload if the user ID matches
              // This prevents tutor103's navbar from reloading when tutor101 logs in
              if (currentUser?.id && newUser.id && currentUser.id !== newUser.id) {
                return; // Don't reload - different user
              }
            } catch (e) {
              // If parsing fails, just reload
            }
          }
          
          loadTutorUser();
        } catch (err) {
          console.error('[TUTOR NAVBAR] Failed to parse storage event:', err);
        }
      }
    };

    // Use capture phase to catch events earlier
    window.addEventListener('token-update', handleTokenUpdate, true);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('token-update', handleTokenUpdate, true);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadTutorUser]);

  // Removed excessive logging to prevent console flooding

  const handleLogout = useCallback(async () => {
    try {
      if (user?.id) {
        socket.emit("leave-tutor-room", user.id);
      }
      await api.post(apiPath("/logout"), {});
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // ✅ CRITICAL: Clear ALL auth states to prevent showing old user data
      clearAllAuthStates();
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
          {/* 🪙 TUTOR COIN DISPLAY - Always read fresh from sessionStorage first, then localStorage */}
          {(() => {
            // ✅ CRITICAL: Check sessionStorage FIRST (tab-specific), then localStorage
            let displayCoins = user?.coins;
            
            const tabTutorData = sessionStorage.getItem('tabTutorData');
            if (tabTutorData) {
              try {
                const freshUser = JSON.parse(tabTutorData);
                displayCoins = freshUser.tokens ?? freshUser.coins ?? user?.coins;
              } catch (e) {
                // If parsing fails, fall through to localStorage
              }
            }
            
            // Fallback to localStorage if sessionStorage doesn't have it
            if (displayCoins === undefined || displayCoins === null) {
              const freshUserJson = localStorage.getItem('tutorUser');
              if (freshUserJson) {
                try {
                  const freshUser = JSON.parse(freshUserJson);
                  displayCoins = freshUser.tokens ?? freshUser.coins ?? user?.coins;
                } catch (e) {
                  // Fallback to state value
                }
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
                background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                borderRadius: "12px",
                px: 3,
                py: 1,
                textTransform: "none",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
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

