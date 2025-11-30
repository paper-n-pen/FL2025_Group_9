// src/components/Navbar.tsx
import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, Box, Button, Chip, Container, Typography } from "@mui/material";
import { getActiveAuthState, clearAuthState, storeAuthState } from "../utils/authStorage";
import { getSocket } from "../socket";
import { apiPath } from "../config";
import api from "../lib/api";
import type { SupportedUserType } from "../utils/authStorage";

interface NavbarProps {
  onEndSessionClick?: () => void;
  showLogout?: boolean;
  showProfile?: boolean;
  showDashboard?: boolean;
  onDashboardClick?: () => void;
}

export default function Navbar({
  onEndSessionClick,
  showLogout = true,
  showProfile = false,
  showDashboard = false,
  onDashboardClick,
}: NavbarProps) {
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

  // Load user based on current page type
  useEffect(() => {
    const isSessionPage = location.pathname.startsWith('/session/');
    
    // 🔥 CRITICAL FIX: sessionStorage can be copied between tabs
    // Determine userType from URL path instead of sessionStorage
    let userTypeFromPath: SupportedUserType | null = null;
    if (location.pathname.startsWith('/tutor/') || location.pathname.includes('tutor')) {
      userTypeFromPath = 'tutor';
    } else if (location.pathname.startsWith('/student/') || location.pathname.includes('student')) {
      userTypeFromPath = 'student';
    }
    
    console.log('[NAVBAR] 🔄 loadUser triggered:', {
      path: location.pathname,
      isSessionPage,
      userTypeFromPath,
    });
    
    if (isSessionPage) {
      // ON SESSION PAGES: Use localStorage but determine which user based on sessionStorage
      // (SessionRoom sets markActiveUserType when component loads)
      const sessionType = sessionStorage.getItem('activeUserType') as SupportedUserType | null;
      
      console.log('[NAVBAR] 📍 Session page, checking storage:', {
        sessionStorageActiveType: sessionType,
        studentUserExists: !!localStorage.getItem('studentUser'),
        tutorUserExists: !!localStorage.getItem('tutorUser'),
      });
      
      if (sessionType) {
        // Read from the SPECIFIC user type's storage
        const keys = sessionType === 'student' 
          ? { user: 'studentUser' } 
          : { user: 'tutorUser' };
        
        const userJson = localStorage.getItem(keys.user);
        console.log('[NAVBAR] 🔍 Reading from localStorage:', {
          sessionStorageType: sessionType,
          keyToRead: keys.user,
          exists: !!userJson,
          rawDataPreview: userJson ? userJson.substring(0, 100) : 'null',
        });
        
        if (userJson) {
          try {
            const parsedUser = JSON.parse(userJson);
            
            // 🔥 FINAL SAFETY CHECK: Verify userType matches
            const userTypeMatches = (
              parsedUser.userType === sessionType ||
              parsedUser.user_type === sessionType ||
              parsedUser.role === sessionType
            );
            
            if (!userTypeMatches) {
              console.error('[NAVBAR] ❌ MISMATCH! sessionStorage says one type, localStorage has another:', {
                sessionStorageType: sessionType,
                parsedUserType: parsedUser.userType || parsedUser.user_type || parsedUser.role,
                userId: parsedUser.id,
                CRITICAL: 'Data corruption detected!',
              });
            }
            
            // Force the correct userType
            parsedUser.userType = sessionType;
            
            setUser(parsedUser);
            console.log('[NAVBAR] ✅ FINAL: Loaded user from localStorage (session page):', {
              userId: parsedUser.id,
              userType: sessionType,
              coins: parsedUser.tokens,
              storageKey: keys.user,
              NO_API_ME_CALLED: true,
            });
          } catch (err) {
            console.error('[NAVBAR] Failed to parse user JSON:', err);
          }
        } else {
          console.error('[NAVBAR] ❌ localStorage key is empty:', keys.user);
        }
      } else {
        console.error('[NAVBAR] ❌ No activeUserType in sessionStorage! Using fallback...');
        // Fallback: Check both localStorage keys and use the one that exists
        const studentJson = localStorage.getItem('studentUser');
        const tutorJson = localStorage.getItem('tutorUser');
        
        if (tutorJson) {
          const parsed = JSON.parse(tutorJson);
          setUser({ ...parsed, userType: 'tutor' });
          console.log('[NAVBAR] ⚠️ Fallback to tutorUser');
        } else if (studentJson) {
          const parsed = JSON.parse(studentJson);
          setUser({ ...parsed, userType: 'student' });
          console.log('[NAVBAR] ⚠️ Fallback to studentUser');
        }
      }
    } else {
      // ON DASHBOARD PAGES: Use /api/me (safe - correct cookie)
      console.log('[NAVBAR] 📍 Dashboard page detected, fetching from /api/me...');
      (async () => {
        try {
          const data = await api.get(apiPath("/me"));
          if (data?.user) {
            const fetchedUser = data.user;
            const userType = fetchedUser.user_type || fetchedUser.userType || active.userType;
            
            const updatedUser = {
              ...fetchedUser,
              userType: userType,
            };
            
            setUser(updatedUser);
            
            if (userType) {
              storeAuthState(userType as SupportedUserType, null, updatedUser);
            }
            
            console.log('[NAVBAR] ✅ Loaded from /api/me (dashboard):', {
              userId: updatedUser.id,
              userType: updatedUser.userType,
              coins: updatedUser.tokens,
            });
          }
        } catch (err) {
          console.error('[NAVBAR] ❌ Failed to fetch /api/me:', err);
          if (active.user) {
            setUser(active.user);
          }
        }
      })();
    }
  }, [location.pathname]);

  // 🔥 Listen for custom token-update events from SessionRoom/Dashboards
  useEffect(() => {
    const handleTokenUpdate = () => {
      const active = getActiveAuthState();
      const isSessionPage = location.pathname.startsWith('/session/');
      
      console.log('[NAVBAR] 🔔 Token update event received:', {
        path: location.pathname,
        isSessionPage,
        activeUserType: active.userType,
      });
      
      if (isSessionPage) {
        // On session pages: Reload from localStorage based on sessionStorage
        const sessionType = sessionStorage.getItem('activeUserType') as SupportedUserType | null;
        
        console.log('[NAVBAR] 🔄 Token update, reloading from localStorage:', {
          sessionStorageType: sessionType,
          studentUserExists: !!localStorage.getItem('studentUser'),
          tutorUserExists: !!localStorage.getItem('tutorUser'),
        });
        
        if (sessionType) {
          const keys = sessionType === 'student' 
            ? { user: 'studentUser' } 
            : { user: 'tutorUser' };
          
          const userJson = localStorage.getItem(keys.user);
          if (userJson) {
            try {
              const parsedUser = JSON.parse(userJson);
              setUser(parsedUser);
              console.log('[NAVBAR] ✅ Reloaded after token update:', {
                userId: parsedUser.id,
                userType: sessionType,
                coins: parsedUser.tokens,
                storageKey: keys.user,
              });
            } catch (err) {
              console.error('[NAVBAR] Failed to parse after update:', err);
            }
          }
        }
      } else {
        // On dashboard pages: Safe to fetch from /api/me
        console.log('[NAVBAR] 🔄 Dashboard page, fetching from /api/me...');
        (async () => {
          try {
            const data = await api.get(apiPath("/me"));
            if (data?.user) {
              const userType = data.user.user_type || data.user.userType;
              setUser({ ...data.user, userType });
              if (userType) {
                storeAuthState(userType as SupportedUserType, null, data.user);
              }
            }
          } catch (err) {
            console.error('[NAVBAR] Failed to fetch after update:', err);
          }
        })();
      }
    };

    window.addEventListener('token-update', handleTokenUpdate);
    return () => {
      window.removeEventListener('token-update', handleTokenUpdate);
    };
  }, [location.pathname]);

  // Log current user tokens whenever user state changes
  useEffect(() => {
    if (user) {
      console.log('[NAVBAR] 🪙 Displaying coins:', {
        userId: user.id,
        userType: user.userType || user.user_type,
        tokens: user.tokens,
        timestamp: new Date().toISOString(),
      });
    }
  }, [user]);

  const handleLogout = useCallback(async () => {
    try {
      const active = getActiveAuthState();
      const userType = active.userType as SupportedUserType;
      
      if (userType === "student" && user?.id) {
        socket.emit("leave-student-room", user.id);
      } else if (userType === "tutor" && user?.id) {
        socket.emit("leave-tutor-room", user.id);
      }
      
      await api.post(apiPath("/logout"), {});
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      const active = getActiveAuthState();
      const userType = active.userType as SupportedUserType;
      if (userType) {
        clearAuthState(userType);
      }
      
      // Determine redirect based on current path
      if (location.pathname.startsWith("/tutor")) {
        navigate("/tutor/login", { replace: true });
      } else {
        navigate("/student/login", { replace: true });
      }
    }
  }, [user, socket, navigate, location.pathname]);

  const handleDashboardClick = useCallback(() => {
    if (onDashboardClick) {
      onDashboardClick();
    } else {
      const active = getActiveAuthState();
      const userType = active.userType;
      if (userType === "student") {
        navigate("/student/dashboard", { replace: false });
      } else if (userType === "tutor") {
        navigate("/tutor/dashboard", { replace: false });
      }
    }
  }, [onDashboardClick, navigate]);

  const handleProfileClick = useCallback(() => {
    const active = getActiveAuthState();
    const userType = active.userType;
    if (userType === "tutor") {
      navigate("/tutor/profile", { replace: false });
    }
    // Students don't have a profile page currently
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
          {/* 🪙 COIN DISPLAY - Shows logged-in user's coins from database */}
          {user && (user.tokens !== undefined && user.tokens !== null) && (
            <Chip
              label={`🪙 ${user.tokens} Coins`}
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
              disabled={location.pathname === "/tutor/dashboard" || location.pathname === "/student/dashboard"}
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

