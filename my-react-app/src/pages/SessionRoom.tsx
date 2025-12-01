// src/pages/SessionRoom.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import type { AlertColor, SnackbarCloseReason } from "@mui/material";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import DrawIcon from "@mui/icons-material/Draw";
import CloseIcon from "@mui/icons-material/Close";
import Whiteboard from "../Whiteboard";
import VideoCallPanel from "../components/VideoCallPanel";
import {
  getActiveAuthState,
  getAuthStateForType,
  markActiveUserType,
  storeAuthState,
} from "../utils/authStorage";
import { getSocket } from "../socket";
import { apiPath } from "../config";
import type { SupportedUserType } from "../utils/authStorage";
import api from "../lib/api";
import axios from "axios";
import { useSessionContext } from "../contexts/SessionContext";

type Message = {
  id: string;
  text: string;
  sender: string;
  timestamp: string;
};

type AuthUser = {
  id: number;
  username: string;
  name?: string;
  email?: string;
  userType: SupportedUserType;
  [key: string]: unknown;
};

const resolveUserType = (value?: string | null, fallback?: string | null): SupportedUserType => {
  const candidate = (value || fallback || "").toLowerCase();
  return candidate === "tutor" ? "tutor" : "student";
};

const normalizeAuthUser = (raw: any, fallbackType?: string | null): AuthUser => {
  const userType = resolveUserType(raw?.userType ?? raw?.role, fallbackType);
  const username =
    raw?.username ||
    raw?.name ||
    (typeof raw?.email === "string" ? raw.email.split("@")[0] : undefined) ||
    `user-${raw?.id ?? Date.now()}`;
  const name = raw?.name ?? raw?.username ?? username;

  return {
    ...raw,
    id: Number(raw?.id ?? 0),
    username,
    name,
    email: raw?.email,
    userType,
  };
};

type Snack = {
  id: number;
  message: string;
  severity: AlertColor;
  open: boolean;
};

export default function SessionRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [snacks, setSnacks] = useState<Snack[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Timer state
  const [timerStatus, setTimerStatus] = useState<
    "idle" | "running" | "paused" | "awaitingExtension" | "ended"
  >("idle");
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [blockNumber, setBlockNumber] = useState<number>(1);
  const [extensionRequestPending, setExtensionRequestPending] = useState(false);
  const [extensionPrompt, setExtensionPrompt] = useState(false);
  const [sessionEndedReason, setSessionEndedReason] = useState<string | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [pendingEndReason, setPendingEndReason] = useState<"manual" | "block-finished" | null>(null);
  const [showRating, setShowRating] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const socket = useMemo(() => getSocket(), []);
  const redirectTimeoutRef = useRef<number | null>(null);
  const snackIdRef = useRef(0);

  // Ensure the session fills the screen
  const containerMax = "xl";

  // Determine user role
  const isTutor = user?.userType === "tutor";
  const isStudent = user?.userType === "student";
  
  // Get session context to provide handlers to Navbar
  const { setEndSessionHandler, setDashboardHandler } = useSessionContext();
  
  // Handler for Dashboard button - leaves session (pauses timer) then navigates
  const handleDashboardNavigation = useCallback(() => {
    if (!sessionId) return;
    
    // Emit leave-session to pause timer (not end session)
    socket.emit("leave-session", sessionId);
    
    // Navigate to appropriate dashboard
    if (isTutor) {
      navigate("/tutor/dashboard", { replace: false });
    } else if (isStudent) {
      navigate("/student/dashboard", { replace: false });
    } else {
      navigate("/", { replace: false });
    }
  }, [sessionId, socket, navigate, isTutor, isStudent]);

  // ---------- helpers ----------
  // Define goBackToDashboard BEFORE it's used in openEndConfirm
  const goBackToDashboard = useCallback(() => {
    const active = getActiveAuthState();
    const resolved = (user?.userType ?? active.userType) as SupportedUserType | null;
    
    console.log('[NAVIGATION] goBackToDashboard called', {
      userFromState: user?.userType,
      activeUserType: active.userType,
      resolved: resolved,
      userId: user?.id,
    });
    
    if (resolved === "tutor") {
      console.log('[NAVIGATION] → Navigating to /tutor/dashboard');
      return navigate("/tutor/dashboard", { replace: true });
    }
    if (resolved === "student") {
      console.log('[NAVIGATION] → Navigating to /student/dashboard');
      return navigate("/student/dashboard", { replace: true });
    }
    console.log('[NAVIGATION] → Navigating to / (no role found)');
    navigate("/", { replace: true });
  }, [navigate, user?.userType]);
  
  // Open end confirmation dialog
  const openEndConfirm = useCallback(() => {
    console.log('[END SESSION] openEndConfirm called, timerStatus:', timerStatus);
    
    if (timerStatus === "ended") {
      // If already ended, just navigate away (existing behavior)
      console.log('[END SESSION] Session already ended, navigating to dashboard');
      goBackToDashboard();
      return;
    }

    // Determine the reason based on current status
    if (timerStatus === "awaitingExtension") {
      setPendingEndReason("block-finished");
    } else {
      setPendingEndReason("manual");
    }
    console.log('[END SESSION] Opening confirmation dialog');
    setShowEndConfirm(true);
  }, [timerStatus, goBackToDashboard]);

  // ---------- end session ----------
  // Note: handleEndSession now uses openEndConfirm for the new confirmation flow
  const handleEndSession = useCallback(() => {
    if (!sessionId) return;
    console.log('[END SESSION] Button clicked, opening confirmation dialog');
    openEndConfirm();
  }, [sessionId, openEndConfirm]);
  
  // Provide handlers to Navbar via context
  useEffect(() => {
    setEndSessionHandler(() => handleEndSession);
    setDashboardHandler(() => handleDashboardNavigation);
    return () => {
      setEndSessionHandler(null);
      setDashboardHandler(null);
    };
  }, [setEndSessionHandler, setDashboardHandler, sessionId, handleDashboardNavigation, handleEndSession]);

  // Format remaining time helper
  const formatRemaining = (ms?: number | null): string => {
    if (!ms || ms <= 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const enqueueSnack = useCallback(
    (message: string, severity: AlertColor) => {
      snackIdRef.current += 1;
      const id = snackIdRef.current;
      setSnacks((prev: Snack[]) => [...prev, { id, message, severity, open: true }]);
    },
    []
  );

  const dismissSnack = useCallback((id: number) => {
    setSnacks((prev: Snack[]) =>
      prev.map((snack) =>
        snack.id === id ? { ...snack, open: false } : snack
      )
    );
  }, []);

  const removeSnack = useCallback((id: number) => {
    setSnacks((prev: Snack[]) => prev.filter((snack) => snack.id !== id));
  }, []);


  const scheduleRedirect = useCallback((targetPath?: string) => {
    if (redirectTimeoutRef.current) window.clearTimeout(redirectTimeoutRef.current);
    // Navigate immediately instead of waiting 1200ms
    console.log('[NAVIGATION] scheduleRedirect called with path:', targetPath);
    if (targetPath) {
      navigate(targetPath, { replace: true });
      return;
    }
    goBackToDashboard();
  }, [goBackToDashboard, navigate]);

  // Refresh current user's COIN BALANCE using session-specific endpoint
  // ✅ SAFE for multi-tab: Uses sessionId + userId, not cookies
  const refreshCurrentUser = useCallback(async () => {
    try {
      const currentUser = user;
      if (!currentUser || !sessionId) {
        console.warn('[🪙 COINS] No current user or sessionId, cannot refresh coins');
        return;
      }

      console.log('[🪙 COINS] Refreshing coins using session-specific endpoint:', {
        sessionId,
        userId: currentUser.id,
        userType: currentUser.userType,
        currentCoins: currentUser.tokens,
      });

      // 🔥 FIX: Use session-specific endpoint instead of /api/me
      // This prevents cookie conflicts in multi-tab scenarios
      const resp = await api.get(
        apiPath(`/queries/session/${sessionId}/user/${currentUser.id}/coins`)
      );

      if (!resp || !resp.ok) {
        console.warn('[🪙 COINS] Session endpoint did not return coins');
        return;
      }

      console.log('[🪙 COINS] Session endpoint returned:', {
        userId: resp.userId,
        userType: resp.userType,
        coins: resp.coins,
      });

      const updatedUser = {
        ...currentUser,  // Keep existing user identity
        tokens: resp.coins,  // Update coins from DB
      };
      
      console.log('[🪙 COINS] 💾 Storing to localStorage:', {
        key: `${currentUser.userType}User`,
        userId: updatedUser.id,
        userType: updatedUser.userType,
        coins: updatedUser.tokens,
      });
      
      storeAuthState(currentUser.userType, null, updatedUser);
      setUser(updatedUser);

      console.log('[🪙 COINS] ✅ Refreshed coins from session endpoint:', {
        userId: updatedUser.id,
        userType: updatedUser.userType,
        previousCoins: currentUser.tokens,
        newCoins: updatedUser.tokens,
        change: updatedUser.tokens - (currentUser.tokens || 0),
      });

      // Dispatch custom event to notify Navbar of coin update
      console.log('[🪙 COINS] 📢 Dispatching token-update event');
      window.dispatchEvent(new CustomEvent('token-update', {
        detail: { userId: updatedUser.id, tokens: updatedUser.tokens }
      }));
    } catch (err) {
      console.error('[🪙 COINS] ❌ Failed to refresh coins', err);
    }
  }, [user, sessionId]);

  // 🔥 NEW: Refresh BOTH student and tutor coins after session ends
  // Use a ref to prevent multiple simultaneous calls
  const refreshingBothCoinsRef = useRef(false);
  
  const refreshBothCoins = useCallback(async () => {
    if (!sessionId) {
      console.warn('[🪙 COINS SYNC] No sessionId, cannot refresh both coins');
      return;
    }

    // Prevent multiple simultaneous calls
    if (refreshingBothCoinsRef.current) {
      console.log('[🪙 COINS SYNC] ⚠️ Already refreshing both coins, skipping duplicate call');
      return;
    }

    refreshingBothCoinsRef.current = true;

    try {
      // Get session participants (student and tutor IDs) from backend
      let studentId: number | null = null;
      let tutorId: number | null = null;

      try {
        const participantsResp = await api.get(apiPath(`/queries/session/${sessionId}/participants`));
        if (participantsResp?.ok && participantsResp.studentId && participantsResp.tutorId) {
          studentId = Number(participantsResp.studentId);
          tutorId = Number(participantsResp.tutorId);
          console.log('[🪙 COINS SYNC] Got session participants:', { studentId, tutorId });
        } else {
          console.warn('[🪙 COINS SYNC] Participants endpoint did not return valid data - session may be deleted');
        }
      } catch (err) {
        console.error('[🪙 COINS SYNC] Failed to get session participants (session may be deleted):', err);
        // ✅ FALLBACK: Try to get IDs from current user context or location state
        const currentUser = user;
        const sessionData = location.state as any;
        if (currentUser?.userType === 'student') {
          studentId = currentUser.id;
          tutorId = sessionData?.tutorId ? Number(sessionData.tutorId) : null;
        } else if (currentUser?.userType === 'tutor') {
          tutorId = currentUser.id;
          studentId = sessionData?.studentId ? Number(sessionData.studentId) : null;
        }
        if (studentId && tutorId) {
          console.log('[🪙 COINS SYNC] Using fallback IDs from context:', { studentId, tutorId });
        }
      }

      if (!studentId || !tutorId) {
        console.warn('[🪙 COINS SYNC] ⚠️ Could not determine both IDs, refreshing current user only', {
          studentId,
          tutorId,
        });
        refreshingBothCoinsRef.current = false;
        await refreshCurrentUser();
        return;
      }

      console.log('[🪙 COINS SYNC] Refreshing both student and tutor coins:', {
        sessionId,
        studentId,
        tutorId,
      });

      // 🔥 CALL BOTH APIs AT THE EXACT SAME TIME (truly parallel)
      // CRITICAL: Prepare URLs first, then initiate both fetch() calls in ONE synchronous block
      const studentPath = apiPath(`/queries/session/${sessionId}/user/${studentId}/coins`);
      const tutorPath = apiPath(`/queries/session/${sessionId}/user/${tutorId}/coins`);
      
      const startTime = performance.now();
      console.log('[🪙 COINS SYNC] 🚀 About to initiate BOTH fetch requests:', {
        studentPath,
        tutorPath,
        timestamp: startTime,
      });
      
      // ✅ CRITICAL: Initiate BOTH fetch() calls in the SAME array literal
      // This ensures they're both created before any await happens
      const fetchOptions = { credentials: 'include' as RequestCredentials, method: 'GET' as const };
      
      // Create both fetch promises in an array - they're both initiated immediately
      const [studentCoinsResp, tutorCoinsResp] = await Promise.all([
        // First fetch - initiated immediately
        fetch(studentPath, fetchOptions).then(async (r) => {
          const json = await r.json();
          console.log('[🪙 COINS SYNC] Student response received at:', performance.now());
          return json;
        }),
        // Second fetch - initiated immediately (same execution context)
        fetch(tutorPath, fetchOptions).then(async (r) => {
          const json = await r.json();
          console.log('[🪙 COINS SYNC] Tutor response received at:', performance.now());
          return json;
        }),
      ]);
      
      const fetchInitTime = performance.now();
      console.log('[🪙 COINS SYNC] ✅ Both fetch() calls initiated in Promise.all, time:', fetchInitTime - startTime, 'ms');
      
      const endTime = performance.now();
      console.log('[🪙 COINS SYNC] ✅ Both APIs completed, total time:', endTime - startTime, 'ms');
      
      console.log('[🪙 COINS SYNC] ✅ Both APIs completed at session end:', {
        studentOk: studentCoinsResp?.ok,
        tutorOk: tutorCoinsResp?.ok,
        studentCoins: studentCoinsResp?.coins,
        tutorCoins: tutorCoinsResp?.coins,
        timestamp: Date.now(),
      });

      // ✅ UPDATE BOTH COINS SIMULTANEOUSLY (both APIs completed)
      // Update student coins
      if (studentCoinsResp && studentCoinsResp.ok) {
        const studentData = {
          id: studentId,
          userType: 'student',
          tokens: studentCoinsResp.coins,
          coins: studentCoinsResp.coins,
        };
        storeAuthState('student', null, studentData);
        console.log('[🪙 COINS SYNC] ✅ Student coins updated:', {
          studentId,
          coins: studentCoinsResp.coins,
        });
      } else {
        console.warn('[🪙 COINS SYNC] ⚠️ Student coins API did not return ok=true');
      }

      // Update tutor coins - ONLY update if tutorId matches the current logged-in tutor
      if (tutorCoinsResp && tutorCoinsResp.ok && tutorId) {
        // ✅ CRITICAL: Check sessionStorage first to get the correct logged-in tutor ID
        const tabTutorId = sessionStorage.getItem('tabTutorId');
        const tabTutorData = sessionStorage.getItem('tabTutorData');
        let loggedInTutorId: number | null = null;
        let loggedInTutor: any = null;
        
        if (tabTutorId && tabTutorData) {
          try {
            loggedInTutor = JSON.parse(tabTutorData);
            if (loggedInTutor && loggedInTutor.id && loggedInTutor.id.toString() === tabTutorId) {
              loggedInTutorId = Number(loggedInTutor.id);
            }
          } catch (e) {
            // If parsing fails, fall back to localStorage
          }
        }
        
        // Fallback to localStorage if sessionStorage doesn't have it
        if (!loggedInTutorId) {
          const currentTutorFromStorage = getAuthStateForType("tutor").user;
          if (currentTutorFromStorage && currentTutorFromStorage.id) {
            loggedInTutorId = Number(currentTutorFromStorage.id);
            loggedInTutor = currentTutorFromStorage;
          }
        }
        
        // ✅ CRITICAL: Only update tutor coins if the session tutor matches the logged-in tutor
        if (loggedInTutorId && loggedInTutorId === tutorId) {
          const tutorData = loggedInTutor
            ? {
                ...loggedInTutor, // Preserve all existing tutor data
                userType: 'tutor',
                tokens: tutorCoinsResp.coins,
                coins: tutorCoinsResp.coins,
              }
            : {
                id: tutorId,
                userType: 'tutor',
                tokens: tutorCoinsResp.coins,
                coins: tutorCoinsResp.coins,
                username: `Tutor ${tutorId}`,
              };
          
          storeAuthState('tutor', null, tutorData);
          
          // Also update sessionStorage
          if (tabTutorId && tabTutorId === tutorId.toString()) {
            sessionStorage.setItem('tabTutorData', JSON.stringify(tutorData));
          }
        } else {
          console.warn('[🪙 COINS SYNC] ⚠️ Skipping tutor coin update - tutor ID mismatch:', {
            sessionTutorId: tutorId,
            loggedInTutorId: loggedInTutorId,
            action: 'Not updating coins for different tutor'
          });
        }
        
        // ✅ CRITICAL: Dispatch event to update TutorNavbar immediately
        // Dispatch multiple times to ensure it's caught
        const dispatchTutorUpdate = () => {
          window.dispatchEvent(new CustomEvent('token-update', { 
            detail: { 
              userId: tutorId,
              tokens: tutorCoinsResp.coins,
              coins: tutorCoinsResp.coins,
              tutorCoins: tutorCoinsResp.coins,
              tutorUserId: tutorId,
            } 
          }));
          window.dispatchEvent(new Event('token-update'));
        };
        dispatchTutorUpdate();
        setTimeout(dispatchTutorUpdate, 50);
        setTimeout(dispatchTutorUpdate, 100);
        
        console.log('[🪙 COINS SYNC] ✅ Tutor coins updated:', {
          tutorId,
          coins: tutorCoinsResp.coins,
          hadExistingData: !!currentTutorFromStorage,
        });
      } else {
        console.warn('[🪙 COINS SYNC] ⚠️ Tutor coins API did not return ok=true', {
          tutorCoinsResp,
          tutorId,
        });
      }

      // ✅ BOTH COINS UPDATED - Dispatch event to notify BOTH navbars simultaneously
      // ✅ CRITICAL: Dispatch with detail to ensure all tabs/components receive the update
      const dispatchUpdate = () => {
        window.dispatchEvent(new CustomEvent('token-update', { 
          detail: { 
            studentCoins: studentCoinsResp?.coins,
            tutorCoins: tutorCoinsResp?.coins,
            tutorUserId: tutorId,
            studentUserId: studentId,
            userId: tutorId, // Also include for backward compatibility
            tokens: tutorCoinsResp?.coins,
            coins: tutorCoinsResp?.coins,
            timestamp: Date.now(),
          } 
        }));
        // Also dispatch plain event for backward compatibility
        window.dispatchEvent(new Event('token-update'));
      };
      
      dispatchUpdate();
      // Dispatch again after a small delay to ensure it's caught
      setTimeout(dispatchUpdate, 50);
      setTimeout(dispatchUpdate, 100);
      setTimeout(dispatchUpdate, 200);
      
      console.log('[🪙 COINS SYNC] 📢 Dispatched token-update event for BOTH navbars (student + tutor)');
      console.log('[🪙 COINS SYNC] ✅ Both student and tutor coins updated simultaneously');
    } catch (err) {
      console.error('[🪙 COINS SYNC] ❌ Error refreshing both coins:', err);
      // Fallback to refreshing current user only
      await refreshCurrentUser();
    } finally {
      refreshingBothCoinsRef.current = false;
    }
  }, [sessionId, user, refreshCurrentUser]);

  // Log component mount for debugging
  useEffect(() => {
    const currentUserId = user?.id;
    const userType = user?.userType;
    console.log("[🪙 SESSION ROOM] Component mounted", {
      sessionId,
      currentUserId,
      userType,
      isTutor,
      isStudent,
    });
  }, [sessionId, user?.id, user?.userType, isTutor, isStudent]);

  const ensureUser = useCallback(async () => {
    // 1) First check location.state for user passed from navigation (e.g., from tutor/student dashboard)
    const locationState = location.state as any;
    if (locationState?.user && locationState?.userType) {
      const normalized = normalizeAuthUser(locationState.user, locationState.userType);
      
      // 🔥 CRITICAL: Set sessionStorage FIRST before anything else
      console.log('[AUTH] 🔐 Setting sessionStorage activeUserType:', normalized.userType);
      markActiveUserType(normalized.userType);
      
      // Then store to localStorage
      storeAuthState(normalized.userType, null, normalized);
      setUser(normalized);
      
      console.log('[AUTH] ✅ User loaded from navigation state:', {
        userId: normalized.id,
        userType: normalized.userType,
        coins: normalized.tokens,
        source: 'location.state (TRUSTED)',
        sessionStorageSet: sessionStorage.getItem('activeUserType'),
        localStorageKey: `${normalized.userType}User`,
      });
      
      // 🔥 CRITICAL FIX: DO NOT call /api/me here!
      // In same-browser multi-tab scenario, /api/me returns whoever's cookie is active,
      // which can be the WRONG user and cause coin swapping.
      // Navigation state already has the correct user data from their dashboard.
      // Coins will be updated via socket events and charge-on-enter responses.
      
      // No extra API calls on mount - trust navigation state completely
      return true;
    }

    // 2) Check localStorage
    const active = getActiveAuthState();
    if (active.user && active.userType) {
      const normalized = normalizeAuthUser(active.user, active.userType);
      markActiveUserType(normalized.userType);
      storeAuthState(normalized.userType, null, normalized);
      setUser(normalized);
      console.log('[AUTH] ✅ User loaded from localStorage (FINAL - NO /api/me call):', {
        userId: normalized.id,
        userType: normalized.userType,
        coins: normalized.tokens,
        source: 'localStorage (TRUSTED - COMPLETE)',
      });
      
      // 🔥 CRITICAL FIX: DO NOT call /api/me here!
      // Cookies are shared in same browser, so /api/me can return wrong user.
      // Trust localStorage data from the dashboard that loaded this user.
      
      // Dispatch event to update navbar
      window.dispatchEvent(new CustomEvent('token-update', {
        detail: { userId: normalized.id, tokens: normalized.tokens }
      }));
      
      return true;
    }

    // 3) Fetch from /api/me as last resort fallback
    try {
      const data = await api.get(apiPath("/me"));
      const fetchedUser = data?.user;
      if (fetchedUser) {
        const serverUserType = fetchedUser.user_type || fetchedUser.userType;
        const normalized = normalizeAuthUser(fetchedUser, serverUserType);
        markActiveUserType(normalized.userType);
        storeAuthState(normalized.userType, null, normalized);
        setUser(normalized);
        console.log('[AUTH] ✅ User loaded from /api/me (fallback):', {
          userId: normalized.id,
          userType: normalized.userType,
          coins: normalized.tokens,
          source: '/api/me (last resort)'
        });
        
        // Dispatch event to update navbar
        window.dispatchEvent(new CustomEvent('token-update', {
          detail: { userId: normalized.id, tokens: normalized.tokens }
        }));
        
        return true;
      }
    } catch (error) {
      console.error("Failed to resolve session user:", error);
    }
    return false;
  }, [location.state]);

  // ---------- join/leave the session room ----------
  // Memoize handlers to prevent infinite loops
  const handleIncomingMessage = useCallback((incoming: Message) => {
    const sanitized: Message = {
      ...incoming,
      sender: incoming.sender || "Participant",
    };
    setMessages((prev: Message[]) => {
      if (prev.some((m) => m.id === sanitized.id)) return prev;
      return [...prev, sanitized];
    });
  }, []);

  const handleSessionEnded = useCallback((payload: { sessionId: string; endedBy: string }) => {
    if (!sessionId) return;
    // Only handle API-ended events (has endedBy, not timer-ended which has reason/blockNumber)
    if (payload?.sessionId?.toString() === sessionId.toString() && payload.endedBy) {
      setConfirmOpen(false);
      setIsEnding(false);
      // This is an API endpoint end - treat as final end and show rating
      setTimerStatus("ended");
      const isStudent = user?.userType === "student";
      if (isStudent && sessionId) {
        enqueueSnack(
          "Session has ended. Please rate your session...",
          "info"
        );
        console.log('[NAVIGATION] handleSessionEnded → Student going to rating page, sessionId:', sessionId);
        navigate(`/student/rate-session/${sessionId}`, { replace: true });
      } else {
        enqueueSnack(
          "Session has ended. Redirecting to your dashboard...",
          "info"
        );
        console.log('[NAVIGATION] handleSessionEnded → Tutor going to dashboard');
        navigate("/tutor/dashboard", { replace: true });
      }
    }
  }, [sessionId, user?.userType, enqueueSnack, navigate]);

  useEffect(() => {
    if (!sessionId) {
      navigate("/", { replace: true });
      return;
    }

    let mounted = true;
    const handleConnect = () => {
      console.log("Joining session", sessionId);
      socket.emit("join-session", sessionId);
    };

    (async () => {
      const ok = await ensureUser();
      if (!mounted) return;
      if (!ok) {
        navigate("/", { replace: true });
        return;
      }

      socket.off("connect", handleConnect);
      socket.off("session-message", handleIncomingMessage);
      socket.off("session-ended", handleSessionEnded);

      socket.on("connect", handleConnect);
      socket.on("session-message", handleIncomingMessage);
      socket.on("session-ended", handleSessionEnded);

      if (socket.connected) handleConnect();
    })();

    return () => {
      mounted = false;
      console.log("Leaving session", sessionId);
      socket.emit("leave-session", sessionId);
      socket.off("connect", handleConnect);
      socket.off("session-message", handleIncomingMessage);
      socket.off("session-ended", handleSessionEnded);
    };
  }, [
    sessionId,
    socket,
    navigate,
    ensureUser,
    handleIncomingMessage,
    handleSessionEnded,
  ]);

  // autoscroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  // ---------- Timer socket listeners ----------
  useEffect(() => {
    if (!socket || !sessionId) return;

    const handleStarted = (payload: {
      sessionId: string;
      blockNumber?: number;
      remainingMs?: number;
      status?: string;
    }) => {
      if (payload.sessionId !== sessionId) return;
      setBlockNumber(payload.blockNumber ?? 1);
      setRemainingMs(payload.remainingMs ?? null);
      setTimerStatus((payload.status as typeof timerStatus) ?? "running");
      setExtensionRequestPending(false);
      setExtensionPrompt(false);
      setSessionEndedReason(null);
      
      // No coin refresh needed - already done when clicking "Start Session"
    };

    const handleUpdate = (payload: {
      sessionId: string;
      blockNumber?: number;
      remainingMs?: number;
      status?: string;
    }) => {
      if (payload.sessionId !== sessionId) return;
      setBlockNumber(payload.blockNumber ?? 1);
      setRemainingMs(payload.remainingMs ?? null);
      setTimerStatus((payload.status as typeof timerStatus) ?? "running");
    };

    const handleBlockEnded = (payload: { sessionId: string; blockNumber?: number }) => {
      if (payload.sessionId !== sessionId) return;
      setTimerStatus("awaitingExtension");
    };

    const handleExtensionRequest = (payload: { sessionId: string; blockNumber?: number }) => {
      if (payload.sessionId !== sessionId) return;
      if (isTutor) {
        setExtensionPrompt(true);
      }
    };

    const handleExtensionAccepted = (payload: {
      sessionId: string;
      blockNumber?: number;
      remainingMs?: number;
    }) => {
      if (payload.sessionId !== sessionId) return;
      setBlockNumber(payload.blockNumber ?? ((prev) => prev + 1));
      setRemainingMs(payload.remainingMs ?? null);
      setTimerStatus("running");
      setExtensionRequestPending(false);
      setExtensionPrompt(false);
    };

    const handleEnded = async (payload: {
      sessionId: string;
      reason?: string;
      blockNumber?: number;
      remainingMs?: number;
      endedBy?: string; // API endpoint payload
    }) => {
      if (payload.sessionId !== sessionId) return;
      // Check if this is a timer-ended event (has reason and blockNumber) vs API-ended (has endedBy)
      if (payload.reason !== undefined || payload.blockNumber !== undefined) {
        // This is a timer-ended event - final end
        setTimerStatus("ended");
        setSessionEndedReason(payload.reason || "Session ended");
        
        // 🔄 SYNC BOTH STUDENT AND TUTOR COINS FROM DATABASE after session ends
        console.log('[🪙 COINS SYNC] Session ended, syncing both coins from database...');
        try {
          await refreshBothCoins();
          console.log('[🪙 COINS SYNC] ✅ Both coins synced successfully from database');
          // ✅ CRITICAL: Small delay to ensure localStorage updates are written before navigation
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error('[🪙 COINS SYNC] ❌ Failed to sync coins:', error);
        }
        
        // Get FRESH user type after sync
        const currentUser = user;
        const currentIsStudent = currentUser?.userType === "student";
        const currentIsTutor = currentUser?.userType === "tutor";
        
        console.log('[NAVIGATION] Session ended, determining redirect:', {
          userType: currentUser?.userType,
          isStudent: currentIsStudent,
          isTutor: currentIsTutor,
        });
        
        // Navigate students to rating page after final end
        if (currentIsStudent && sessionId) {
          console.log('[NAVIGATION] → Student going to rating page, sessionId:', sessionId);
          enqueueSnack("Session ended. Redirecting to rating page...", "info");
          // Navigate to rating page immediately (tokens already synced)
          setTimeout(() => {
            navigate(`/student/rate-session/${sessionId}`, { replace: true });
          }, 300);
        } else if (currentIsTutor) {
          // For tutors, just go back to tutor dashboard
          console.log('[NAVIGATION] → Tutor going back to tutor dashboard');
          navigate("/tutor/dashboard", { replace: true });
        } else {
          console.log('[NAVIGATION] → Unknown role, using goBackToDashboard');
          goBackToDashboard();
        }
      }
      // If it's an API-ended event (has endedBy), let the existing handler in the other useEffect handle it
    };

    socket.on("session-started", handleStarted);
    socket.on("session-timer-update", handleUpdate);
    socket.on("session-block-ended", handleBlockEnded);
    socket.on("session-extension-request", handleExtensionRequest);
    socket.on("session-extension-accepted", handleExtensionAccepted);
    socket.on("session-ended", handleEnded);

    return () => {
      socket.off("session-started", handleStarted);
      socket.off("session-timer-update", handleUpdate);
      socket.off("session-block-ended", handleBlockEnded);
      socket.off("session-extension-request", handleExtensionRequest);
      socket.off("session-extension-accepted", handleExtensionAccepted);
      socket.off("session-ended", handleEnded);
    };
  }, [socket, sessionId, isTutor, isStudent, navigate, goBackToDashboard, refreshCurrentUser]);

  // ---------- Timer button handlers ----------
  // File: my-react-app/src/pages/SessionRoom.tsx
  // Component: SessionRoom (used by both tutor and student, but only tutor can start)
  const handleStartSession = async () => {
    if (!sessionId) {
      console.error("[TOKENS V2 ERROR] handleStartSession called without sessionId");
      alert("Missing sessionId – cannot start session.");
      return;
    }

    const currentUserId = user?.id;

      console.log("[🪙 COINS] FRONTEND handleStartSession CLICK", {
        sessionId,
        currentUserId,
      });

    try {
      // 1) CALL BACKEND TO START TIMER (no coin transfer here)
      const res = await axios.post(`/api/queries/session/${sessionId}/start`);

      console.log(
        "[🪙 COINS] FRONTEND /api/queries/session/:sessionId/start RESPONSE",
        res.data
      );

      if (!res.data || res.data.ok !== true) {
        console.error(
          "[🪙 COINS ERROR] Backend did not return ok=true",
          res.data
        );
        alert(res.data?.message || "Failed to start session");
        return;
      }

      // 2) EMIT SOCKET EVENT ONLY AFTER SUCCESS
      if (socket) {
        socket.emit("session-start", {
          sessionId,
          startedBy: currentUserId,
        });
        console.log("[🪙 COINS] FRONTEND socket.emit('session-start') sent", {
          sessionId,
          startedBy: currentUserId,
        });
      } else {
        console.warn("[🪙 COINS WARN] No socket instance in handleStartSession");
      }

      // 🔥 TUTOR COIN UPDATE: ONLY API call - when clicking "Start Session Timer"
      if (user && sessionId && isTutor) {
        console.log('[🪙 COINS] 🔥 Tutor clicked Start Session - calling API for fresh coins...');
        try {
          const resp = await api.get(
            apiPath(`/queries/session/${sessionId}/user/${user.id}/coins`)
          );

          if (resp && resp.ok && resp.coins !== undefined) {
            const updatedUser = {
              ...user,
              tokens: resp.coins,
            };
            storeAuthState(user.userType, null, updatedUser);
            setUser(updatedUser);

            console.log('[🪙 COINS] ✅ Tutor coins updated on Start Session click:', {
              userId: updatedUser.id,
              coins: updatedUser.tokens,
              source: 'session endpoint (ONLY on Start Session click)',
            });

            // Dispatch event to update TutorNavbar
            window.dispatchEvent(new CustomEvent('token-update', {
              detail: { userId: updatedUser.id, tokens: updatedUser.tokens }
            }));
          }
        } catch (syncErr) {
          console.error('[🪙 COINS] ❌ Failed to fetch coins:', syncErr);
          // Don't block timer if sync fails
        }
      }

      // 3) UPDATE LOCAL UI STATE – start timer, disable button, etc.
      // Timer listeners will handle the rest via socket events (timerStatus will change to 'running')
    } catch (err: any) {
      console.error("[🪙 COINS ERROR] Exception in handleStartSession", err);
      alert("Error starting session. Please try again.");
    }
  };

  const handleStudentExtend = () => {
    if (!socket || !sessionId) return;
    setExtensionRequestPending(true);
    socket.emit("session-extension-request", { sessionId });
  };

  const handleStudentEndNow = async () => {
    if (!socket || !sessionId) return;
    // When student clicks "End Session" in awaitingExtension state, hard end the session
    socket.emit("session-hard-end", { sessionId, reason: "block-ended-student-chose-end" });
    
    // 🔄 SYNC COINS FROM DATABASE after student ends session (immediate sync)
    console.log('[🪙 COINS SYNC] Student ended session, syncing coins from database...');
    try {
      await refreshCurrentUser();
      console.log('[🪙 COINS SYNC] ✅ Coins synced successfully from database');
    } catch (error) {
      console.error('[🪙 COINS SYNC] ❌ Failed to sync coins:', error);
    }
  };

  const handleTutorAcceptExtension = () => {
    if (!socket || !sessionId) return;
    setExtensionPrompt(false);
    socket.emit("session-extension-response", { sessionId, accepted: true });
  };

  const handleTutorDeclineExtension = () => {
    if (!socket || !sessionId) return;
    setExtensionPrompt(false);
    socket.emit("session-extension-response", { sessionId, accepted: false });
  };

  const handleHardEnd = async () => {
    if (!sessionId || !user) return;
    setShowEndConfirm(false);
    setIsEnding(true);
    
    try {
      // Call API endpoint to end session
      await api.post(apiPath("/queries/session/end"), {
        sessionId: Number(sessionId),
        endedBy: user.id,
      });
      
      // Also emit socket event for immediate UI update
      if (socket) {
        socket.emit("session-hard-end", { sessionId, reason: "manual-end" });
      }
      
      // 🔄 SYNC BOTH STUDENT AND TUTOR COINS FROM DATABASE after hard end
      console.log('[🪙 COINS SYNC] Hard end triggered, syncing both coins from database...');
      try {
        await refreshBothCoins();
        console.log('[🪙 COINS SYNC] ✅ Both coins synced successfully from database');
        // ✅ CRITICAL: Small delay to ensure localStorage updates are written before navigation
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('[🪙 COINS SYNC] ❌ Failed to sync coins:', error);
      }
      
      // Navigate immediately after ending session
      const currentIsStudent = user.userType === "student";
      const currentIsTutor = user.userType === "tutor";
      
      console.log('[NAVIGATION] handleHardEnd determining redirect:', {
        userType: user.userType,
        isStudent: currentIsStudent,
        isTutor: currentIsTutor,
      });
      
      if (currentIsStudent && sessionId) {
        enqueueSnack("Session ended successfully. Redirecting to rating page...", "success");
        console.log('[NAVIGATION] → Student going to rating page, sessionId:', sessionId);
        setTimeout(() => {
          navigate(`/student/rate-session/${sessionId}`, { replace: true });
        }, 300);
      } else if (currentIsTutor) {
        enqueueSnack("Session ended successfully. Redirecting to your dashboard...", "success");
        console.log('[NAVIGATION] → Tutor going to tutor dashboard');
        navigate("/tutor/dashboard", { replace: true });
      } else {
        console.log('[NAVIGATION] → Unknown role, using goBackToDashboard');
        enqueueSnack("Session ended successfully.", "success");
        goBackToDashboard();
      }
    } catch (err) {
      console.error("Hard end session failed:", err);
      enqueueSnack("Failed to end session. Please try again.", "error");
    } finally {
      setIsEnding(false);
    }
  };

  // Handle "Leave session (can rejoin)" option
  const handleLeaveSession = () => {
    setShowEndConfirm(false);
    // Just navigate away - backend will automatically pause timer when user leaves
    // User can rejoin later if time remains
    goBackToDashboard();
  };

  // ---------- chat send ----------
  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !sessionId) return;

    const senderName = user.username || user.name || "You";
    const msg: Message = {
      id: Date.now().toString(),
      text: newMessage.trim(),
      sender: senderName,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev: Message[]) => [...prev, msg]);
    setNewMessage("");

    socket.emit("session-message", { sessionId, message: msg });
  };

  const confirmEndSession = async () => {
    if (!sessionId || !user) return;
    setIsEnding(true);
    try {
      await api.post(apiPath("/queries/session/end"), {
        sessionId: Number(sessionId),
        endedBy: user.id,
      });
      
      // 🔄 SYNC BOTH STUDENT AND TUTOR COINS FROM DATABASE after session ends
      console.log('[🪙 COINS SYNC] Session ended via API, syncing both coins from database...');
      try {
        await refreshBothCoins();
        console.log('[🪙 COINS SYNC] ✅ Both coins synced successfully from database');
      } catch (error) {
        console.error('[🪙 COINS SYNC] ❌ Failed to sync coins:', error);
      }
      
      setConfirmOpen(false);
      const currentIsStudent = user.userType === "student";
      const currentIsTutor = user.userType === "tutor";
      
      console.log('[NAVIGATION] confirmEndSession determining redirect:', {
        userType: user.userType,
        isStudent: currentIsStudent,
        isTutor: currentIsTutor,
      });
      
      if (currentIsStudent && sessionId) {
        enqueueSnack("Session ended successfully. Redirecting to rating page...", "success");
        console.log('[NAVIGATION] → Student going to rating page, sessionId:', sessionId);
        setTimeout(() => {
          navigate(`/student/rate-session/${sessionId}`, { replace: true });
        }, 300);
      } else if (currentIsTutor) {
        enqueueSnack("Session ended successfully. Redirecting to your dashboard...", "success");
        console.log('[NAVIGATION] → Tutor going to tutor dashboard');
        navigate("/tutor/dashboard", { replace: true });
      } else {
        console.log('[NAVIGATION] → Unknown role, using goBackToDashboard');
        enqueueSnack("Session ended successfully.", "success");
        goBackToDashboard();
      }
    } catch (err) {
      console.error("End session failed:", err);
      enqueueSnack("Failed to end session. Please try again.", "error");
    } finally {
      setIsEnding(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        background: "linear-gradient(135deg, #37353E 0%, #44444E 50%, #37353E 100%)",
        backgroundAttachment: "fixed",
        display: "flex",
        flexDirection: "column",
      }}
    >

      {/* Main content */}
      <Container
        maxWidth={containerMax}
        sx={{
          flex: 1,
          py: 4,
        }}
      >
        {/* Session Room Title - Centered */}
        <Typography
          variant="h4"
          fontWeight="bold"
          align="center"
          sx={{
            mb: 4,
            color: "text.primary",
          }}
        >
          {isTutor ? "Tutor Session Room" : isStudent ? "Student Session Room" : "Session Room"}
        </Typography>

        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", lg: "row" },
            gap: 4,
            alignItems: { lg: "stretch" },
          }}
        >
          {/* Whiteboard - Left side on desktop, top on mobile */}
          <Box sx={{ width: { xs: "100%", lg: "50%" } }}>
            <Paper
              elevation={5}
              sx={{
                p: 3,
                borderRadius: 4,
                display: "flex",
                flexDirection: "column",
                height: "100%",
              }}
            >
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <DrawIcon color="primary" />
                <Typography variant="h5" fontWeight="bold">
                  Whiteboard
                </Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Box flex={1} minHeight={{ xs: 420, lg: 500 }}>
                <Whiteboard socket={socket} sessionId={sessionId!} />
              </Box>
            </Paper>
          </Box>

          {/* Video Call - Right side on desktop, bottom on mobile */}
          <Box sx={{ width: { xs: "100%", lg: "50%" } }}>
            {/* Timer Bar */}
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                alignItems: { xs: "flex-start", sm: "center" },
                justifyContent: "space-between",
                mb: 1,
                p: 1.5,
                bgcolor: "background.paper",
                borderRadius: 2,
                boxShadow: 1,
                gap: { xs: 1, sm: 0 },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <Typography variant="subtitle2">
                  Session time (block {blockNumber}):{" "}
                  <strong>{formatRemaining(remainingMs)}</strong>
                </Typography>

                {/* STATUS TAG */}
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {timerStatus === "idle" && "Waiting to start"}
                  {timerStatus === "running" && "In progress"}
                  {timerStatus === "paused" && "Paused"}
                  {timerStatus === "awaitingExtension" && "Block finished"}
                  {timerStatus === "ended" && "Session ended"}
                </Typography>
              </Box>

              {/* ACTION BUTTONS */}
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {/* Tutor: can start the session only when idle */}
                {isTutor && timerStatus === "idle" && (
                  <Button 
                    size="small" 
                    variant="contained" 
                    onClick={handleStartSession}
                    sx={{ borderRadius: "12px" }}
                  >
                    Start Session Timer
                  </Button>
                )}

                {/* Student side: when block finished, choose extend or end */}
                {isStudent && timerStatus === "awaitingExtension" && (
                  <>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={extensionRequestPending}
                      onClick={handleStudentExtend}
                      sx={{ borderRadius: "12px" }}
                    >
                      {extensionRequestPending ? "Request sent..." : "Extend 10 min"}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={handleStudentEndNow}
                      sx={{ borderRadius: "12px" }}
                    >
                      End Session
                    </Button>
                  </>
                )}

                {/* Global hard-end button when session is not yet ended */}
                {timerStatus !== "ended" && (
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={openEndConfirm}
                    sx={{ borderRadius: "12px" }}
                  >
                    End Now
                  </Button>
                )}
              </Box>
            </Box>

            {/* Tutor Extension Prompt */}
            {isTutor && extensionPrompt && timerStatus === "awaitingExtension" && (
              <Alert
                severity="info"
                sx={{
                  mb: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>Student requested to extend the session by 10 minutes.</span>
                <Box sx={{ display: "flex", gap: 1, ml: 2 }}>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={handleTutorAcceptExtension}
                  >
                    Accept
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={handleTutorDeclineExtension}
                  >
                    Decline
                  </Button>
                </Box>
              </Alert>
            )}

            {/* Session Ended Alert - only show if not showing rating */}
            {timerStatus === "ended" && sessionEndedReason && !showRating && (
              <Alert severity="success" sx={{ mb: 1 }}>
                {sessionEndedReason || "Session ended."}
              </Alert>
            )}

            {sessionId && (
              <VideoCallPanel socket={socket} sessionId={sessionId} />
            )}
          </Box>
        </Box>
      </Container>

      {/* Floating Chat Toggle Button */}
      {!isChatOpen && (
        <Button
          onClick={() => setIsChatOpen(true)}
          variant="contained"
          sx={{
            position: "fixed",
            bottom: 100,
            right: 24,
            zIndex: 10000,
            borderRadius: "28px",
            px: 3,
            py: 1.5,
            background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
            transition: "all 0.3s ease",
            boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
            "&:hover": {
              transform: "translateY(-2px)",
              boxShadow: "0 8px 24px rgba(139, 92, 246, 0.4)",
              background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
            },
            boxShadow: "0 4px 12px rgba(113, 90, 90, 0.4)",
            textTransform: "none",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 1,
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
            "&:hover": {
              transform: "scale(1.05)",
              boxShadow: "0 6px 16px rgba(113, 90, 90, 0.5)",
              background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
            },
          }}
        >
          <ChatBubbleOutlineIcon />
          Session Chat
        </Button>
      )}

      {/* Floating Chat Panel */}
      {isChatOpen && (
        <Paper
          elevation={24}
          sx={{
            position: "fixed",
            bottom: 100,
            right: 24,
            zIndex: 10001,
            width: { xs: "calc(100% - 48px)", sm: 400 },
            maxWidth: 400,
            maxHeight: "60vh",
            borderRadius: 3,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          {/* Chat Header */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 2,
              py: 1.5,
              borderBottom: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            <Box display="flex" alignItems="center" gap={1}>
              <ChatBubbleOutlineIcon color="primary" />
              <Typography variant="subtitle1" fontWeight="bold">
                Session Chat
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => setIsChatOpen(false)}
              sx={{
                color: "text.secondary",
                "&:hover": {
                  bgcolor: "action.hover",
                },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Messages Area */}
          <Box
            sx={{
              flex: 1,
              overflow: "auto",
              p: 2,
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
            {messages.map((m: Message) => {
              const senderName = user?.username || user?.name;
              const own = senderName ? m.sender === senderName : false;
              const t = new Date(m.timestamp);
              const time = Number.isNaN(t.getTime())
                ? ""
                : t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              return (
                <Box
                  key={m.id}
                  display="flex"
                  justifyContent={own ? "flex-end" : "flex-start"}
                >
                  <Box
                    sx={{
                      px: 2,
                      py: 1.5,
                      borderRadius: "12px",
                      background: own 
                        ? "linear-gradient(135deg, #715A5A 0%, #8a6f6f 100%)"
                        : "rgba(51, 65, 85, 0.8)",
                      color: "white",
                      maxWidth: "80%",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                    }}
                  >
                    <Typography variant="body2" sx={{ color: "white", fontWeight: 500 }}>
                      {m.text}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.8)", display: "block", mt: 0.5 }}>
                      {m.sender}
                      {time ? ` • ${time}` : ""}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
            <div ref={messagesEndRef} />
          </Box>

          {/* Chat Input */}
          <Box
            component="form"
            onSubmit={sendMessage}
            sx={{
              p: 2,
              borderTop: "1px solid",
              borderColor: "divider",
              display: "flex",
              gap: 1,
              bgcolor: "background.paper",
            }}
          >
            <TextField
              fullWidth
              size="small"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewMessage(e.target.value)
              }
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "20px",
                },
              }}
            />
            <Button 
              variant="contained" 
              type="submit"
              sx={{
                background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
            transition: "all 0.3s ease",
            boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
            "&:hover": {
              transform: "translateY(-2px)",
              boxShadow: "0 8px 24px rgba(139, 92, 246, 0.4)",
              background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
            },
                borderRadius: "20px",
                px: 2,
                py: 1,
                minWidth: "auto",
                textTransform: "none",
                fontWeight: 600,
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                "&:hover": {
                  transform: "scale(1.05)",
                  boxShadow: "0 4px 12px rgba(113, 90, 90, 0.4)",
                  background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                },
              }}
            >
              Send
            </Button>
          </Box>
        </Paper>
      )}

      <Dialog
        open={confirmOpen}
        fullWidth
        maxWidth="xs"
        disableEscapeKeyDown={isEnding}
        onClose={(event: React.SyntheticEvent, reason: "backdropClick" | "escapeKeyDown") => {
          if (isEnding) return;
          if (reason === "backdropClick") return;
          setConfirmOpen(false);
        }}
      >
        <DialogTitle>End Session</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Ending the session will remove access for both participants. Are you sure you want to
            continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={() => setConfirmOpen(false)} disabled={isEnding}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmEndSession}
            disabled={isEnding}
          >
            {isEnding ? <CircularProgress size={20} color="inherit" /> : "End Session"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* New End Session Confirmation Dialog - Leave vs Completely End */}
      <Dialog
        open={showEndConfirm}
        fullWidth
        maxWidth="sm"
        onClose={() => setShowEndConfirm(false)}
      >
        <DialogTitle>End Session</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Do you want to leave this session temporarily (you can rejoin as long as time remains),
            or completely end the session for everyone?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, flexDirection: "column", gap: 1, alignItems: "center" }}>
          <Button
            variant="outlined"
            onClick={handleLeaveSession}
            sx={{ textTransform: "none", minWidth: "200px" }}
          >
            Leave session (can rejoin)
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleHardEnd}
            sx={{ textTransform: "none", minWidth: "200px" }}
          >
            Completely end session
          </Button>
          <Button
            variant="text"
            onClick={() => setShowEndConfirm(false)}
            sx={{ mt: 1 }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {snacks.map((snack: Snack) => (
        <Snackbar
          key={snack.id}
          open={snack.open}
          autoHideDuration={2000}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
          onClose={(
            _event: React.SyntheticEvent | Event,
            reason?: SnackbarCloseReason
          ) => {
            if (reason === "clickaway") return;
            dismissSnack(snack.id);
          }}
          TransitionProps={{
            onExited: () => removeSnack(snack.id),
          }}
        >
          <Alert
            severity={snack.severity}
            action={
              <IconButton
                size="small"
                color="inherit"
                aria-label="close"
                onClick={() => dismissSnack(snack.id)}
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
