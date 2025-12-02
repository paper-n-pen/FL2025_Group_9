// src/pages/tutor/TutorDashboard.tsx
// NOTE: Guard against cross-tab account switching:
// if stored user for this tab != /api/me user, force logout in this tab.
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
import { getAuthStateForType, markActiveUserType, clearAuthState, clearAllAuthStates, storeAuthState } from "../../utils/authStorage";
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
  // ✅ Use ref to access latest acceptedQueries without causing useEffect to re-run
  const acceptedQueriesRef = useRef<StudentQuery[]>([]);
  const [tutorUser, setTutorUser] = useState<any>(() => {
    // ✅ CRITICAL: Check sessionStorage FIRST (tab-specific, never cleared by other tabs)
    const tabTutorId = sessionStorage.getItem('tabTutorId');
    const tabTutorData = sessionStorage.getItem('tabTutorData');
    if (tabTutorId && tabTutorData) {
      try {
        const parsed = JSON.parse(tabTutorData);
        if (parsed && parsed.id && parsed.id.toString() === tabTutorId) {
          return parsed;
        }
      } catch (e) {
        // If parsing fails, fall through to localStorage
      }
    }
    // Fallback to localStorage
    const stored = getAuthStateForType("tutor");
    return stored.user;
  });
  const navigate = useNavigate();

  // ✅ Fetch available queries
  // Backend already filters out declined queries, so we don't need the frontend ref filter
  const fetchQueries = useCallback(async () => {
    try {
      if (!tutorUser?.id) return;
      const response = await api.get(apiPath(`/queries/tutor/${tutorUser.id}`));
      // Backend already filters declined queries, so just use the response directly
      setQueries(Array.isArray(response) ? response : []);
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

  // ✅ Auth check - ONLY runs once on mount, uses localStorage as source of truth
  useEffect(() => {
    let isMounted = true;

    // ✅ CRITICAL FIX: Check sessionStorage first to preserve tutor identity per tab
    // sessionStorage is tab-specific, so even if localStorage is cleared by another tab,
    // this tab will remember its tutor identity
    const tabTutorId = sessionStorage.getItem('tabTutorId');
    const tabTutorData = sessionStorage.getItem('tabTutorData');
    
    // If we have tutor data in sessionStorage (tab-specific), use it
    if (tabTutorId && tabTutorData) {
      try {
        const parsedTutor = JSON.parse(tabTutorData);
        if (parsedTutor && parsedTutor.id && parsedTutor.id.toString() === tabTutorId) {
          // ✅ CRITICAL: Check localStorage for more recent coins (from session end)
          const localStorageTutorJson = localStorage.getItem('tutorUser');
          if (localStorageTutorJson) {
            try {
              const localStorageTutor = JSON.parse(localStorageTutorJson);
              // If localStorage has same user ID but different coins, use localStorage (more recent)
              if (localStorageTutor.id === parsedTutor.id && 
                  localStorageTutor.tokens !== undefined && 
                  localStorageTutor.tokens !== parsedTutor.tokens) {
                console.log('[TUTOR DASHBOARD] ✅ Using coins from localStorage (more recent):', {
                  sessionStorageCoins: parsedTutor.tokens,
                  localStorageCoins: localStorageTutor.tokens,
                });
                parsedTutor.tokens = localStorageTutor.tokens;
                parsedTutor.coins = localStorageTutor.coins ?? localStorageTutor.tokens;
              }
            } catch (e) {
              // If parsing fails, use sessionStorage data
            }
          }
          
          // Restore to localStorage if it was cleared
          if (isMounted) {
            setTutorUser(parsedTutor);
            markActiveUserType("tutor");
            // Restore to localStorage so other parts of the app can access it
            storeAuthState("tutor", null, parsedTutor);
          }
          return; // ✅ CRITICAL: Exit early - don't call /api/me at all
        }
      } catch (e) {
        // If parsing fails, continue to check localStorage
      }
    }

    // ✅ CRITICAL: Check sessionStorage FIRST (tab-specific), then localStorage
    // sessionStorage is tab-specific, so it's more reliable for the current tab
    // Note: tabTutorId and tabTutorData already declared above, reusing them here
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
                console.warn('[TUTOR DASHBOARD] 🚨 localStorage has different user ID, clearing it:', {
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
          
          // ✅ CRITICAL: Ensure tokens/coins are preserved (don't reset to 0)
          const tutorWithCoins = {
            ...parsedTutor,
            tokens: parsedTutor.tokens ?? parsedTutor.coins ?? 0,
            coins: parsedTutor.coins ?? parsedTutor.tokens ?? 0,
          };
          
          if (isMounted) {
            setTutorUser(tutorWithCoins);
            markActiveUserType("tutor");
            // Update localStorage with the correct user
            storeAuthState("tutor", null, tutorWithCoins);
          }
          return; // ✅ CRITICAL: Exit early - don't call /api/me at all
        }
      } catch (e) {
        // If parsing fails, continue to check localStorage
      }
    }
    
    // ✅ CRITICAL: Use localStorage as fallback, but verify it matches sessionStorage if available
    const tutorUserJson = localStorage.getItem('tutorUser');
    const existingTutor = tutorUserJson ? (() => {
      try {
        return JSON.parse(tutorUserJson);
      } catch {
        return null;
      }
    })() : null;
    
    // ✅ CRITICAL: If we have tutor data in localStorage, use it and NEVER call /api/me
    // Also save to sessionStorage to preserve it across localStorage clears
    if (existingTutor && existingTutor.id) {
      // ✅ CRITICAL: ALWAYS save to sessionStorage to preserve this tab's identity
      // This ensures that even if localStorage is cleared by another tab, this tab remembers its user
      sessionStorage.setItem('tabTutorId', existingTutor.id.toString());
      sessionStorage.setItem('tabTutorData', JSON.stringify(existingTutor));
      
      // ✅ CRITICAL: Ensure tokens/coins are preserved (don't reset to 0)
      const tutorWithCoins = {
        ...existingTutor,
        tokens: existingTutor.tokens ?? existingTutor.coins ?? 0,
        coins: existingTutor.coins ?? existingTutor.tokens ?? 0,
      };
      
      if (isMounted) {
        setTutorUser(tutorWithCoins);
        markActiveUserType("tutor");
        // Update localStorage to ensure coins are preserved
        storeAuthState("tutor", null, tutorWithCoins);
      }
      return; // ✅ CRITICAL: Exit early - don't call /api/me at all
    }

    // ✅ CRITICAL: If we reach here, both sessionStorage and localStorage are empty
    // This should ONLY happen on first-time login in a new tab
    // Before calling /api/me, do one final check of sessionStorage (race condition protection)
    const lastChanceTabTutorId = sessionStorage.getItem('tabTutorId');
    const lastChanceTabTutorData = sessionStorage.getItem('tabTutorData');
    if (lastChanceTabTutorId && lastChanceTabTutorData) {
      try {
        const parsed = JSON.parse(lastChanceTabTutorData);
        if (parsed && parsed.id && parsed.id.toString() === lastChanceTabTutorId) {
          if (isMounted) {
            setTutorUser(parsed);
            markActiveUserType("tutor");
            storeAuthState("tutor", null, parsed);
          }
          return; // Don't call API
        }
      } catch (e) {
        // Continue to API call
      }
    }

    // Only call /api/me if BOTH sessionStorage AND localStorage are completely empty
    // This should NEVER happen if sessionStorage was properly set
    const fetchTutor = async () => {
      // ✅ CRITICAL: Double-check sessionStorage one more time before calling API
      const finalCheckTabTutorId = sessionStorage.getItem('tabTutorId');
      const finalCheckTabTutorData = sessionStorage.getItem('tabTutorData');
      if (finalCheckTabTutorId && finalCheckTabTutorData) {
        try {
          const parsed = JSON.parse(finalCheckTabTutorData);
          if (parsed && parsed.id && parsed.id.toString() === finalCheckTabTutorId) {
            if (isMounted) {
              setTutorUser(parsed);
              markActiveUserType("tutor");
              storeAuthState("tutor", null, parsed);
            }
            return; // Don't call API
          }
        } catch (e) {
          // Continue to API call
        }
      }

      try {
        // ✅ CRITICAL: Send expectedUserId from sessionStorage if available
        // This tells backend to verify cookie matches expected user
        const tabTutorId = sessionStorage.getItem('tabTutorId');
        const url = tabTutorId 
          ? `${apiPath("/me")}?expectedUserId=${tabTutorId}`
          : apiPath("/me");
        const res = await api.get(url);
        const u = res?.user;
        const resolvedRole = (u?.userType || u?.role || "").toLowerCase();

        if (resolvedRole === "tutor" && u) {
          // ✅ CRITICAL: Guard against cross-tab account switching
          // Read the previously stored user for THIS TAB
          let storedUser: any = null;
          try {
            // Check sessionStorage first (tab-specific)
            const tabTutorData = sessionStorage.getItem('tabTutorData');
            if (tabTutorData) {
              storedUser = JSON.parse(tabTutorData);
            } else {
              // Fallback to localStorage
              const tutorUserJson = localStorage.getItem('tutorUser');
              if (tutorUserJson) {
                storedUser = JSON.parse(tutorUserJson);
              }
            }
          } catch (_) {
            storedUser = null;
          }

          // Extract ids using the same property names current code uses
          const storedUserId = storedUser && (storedUser.id ?? storedUser.userId ?? storedUser.user_id);
          const apiUserId = u && (u.id ?? u.userId ?? u.user_id);

          // If we HAD a stored user, and ids differ → account switched
          // if (storedUserId && apiUserId && storedUserId !== apiUserId) {
          //   console.warn("[AUTH] User ID mismatch - using API user (current logged-in user)", {
          //     storedUserId,
          //     fromApi: apiUserId,
          //     action: 'Clearing old data and using API user'
          //   });

          //   // Clear any auth-related storage for this tab to use the correct user
          //   try {
          //     localStorage.removeItem('tutorUser');
          //     localStorage.removeItem('tutorToken');
          //     sessionStorage.removeItem('tabTutorId');
          //     sessionStorage.removeItem('tabTutorData');
          //     sessionStorage.removeItem('activeUserType');
          //   } catch (_) {}

          //   // Continue to use the API user (don't redirect - just use the correct user)
          //   // This handles the case where localStorage has wrong user but cookie has correct user
          // }




















                    // If we HAD a stored user, and ids differ → account switched in another tab.
          // To avoid this tab silently becoming a different tutor, log out this tab.
          if (storedUserId && apiUserId && storedUserId !== apiUserId) {
            console.warn("[AUTH] 🚨 User ID mismatch for this tab. Stored user and /api/me user differ. Logging out to prevent cross-tab account switch.", {
              storedUserId,
              apiUserId,
            });

            try {
              // Clear all tutor auth state for THIS tab
              clearAuthState("tutor");
              sessionStorage.removeItem("tabTutorId");
              sessionStorage.removeItem("tabTutorData");
            } catch (_) {}

            if (isMounted) {
              navigate("/tutor/login", { replace: true });
            }

            // VERY IMPORTANT: do not continue with API user in this tab
            return;
          }








          




          // ✅ CRITICAL: Preserve coins from localStorage if API returns 0 or undefined
          // This prevents coins from being reset to 0 after session end
          const existingTutorData = (() => {
            try {
              const tutorUserJson = localStorage.getItem('tutorUser');
              if (tutorUserJson) {
                return JSON.parse(tutorUserJson);
              }
            } catch {
              return null;
            }
            return null;
          })();
          
          // If API returns 0/undefined tokens but we have coins in localStorage, use localStorage
          const tokensValue = (u.tokens !== undefined && u.tokens !== null && u.tokens !== 0)
            ? u.tokens
            : (existingTutorData?.tokens ?? existingTutorData?.coins ?? u.tokens ?? 0);
          
          const normalized = { 
            ...u, 
            userType: "tutor",
            username: u.username || u.name,
            tokens: tokensValue,
            coins: tokensValue,
          };
          
          // Save to sessionStorage to preserve this tab's identity
          sessionStorage.setItem('tabTutorId', normalized.id.toString());
          sessionStorage.setItem('tabTutorData', JSON.stringify(normalized));
          
          if (isMounted) {
            setTutorUser(normalized);
            markActiveUserType("tutor");
            storeAuthState("tutor", null, normalized);
          }

          console.log("[AUTH] /api/me user confirmed for this tab", {
            userId: apiUserId,
          });

          return;
        }
      } catch (error: any) {
        // ✅ CRITICAL: If backend returns 403 (user mismatch), use sessionStorage data
        if (error?.message?.includes('403') || error?.message?.includes('User mismatch')) {
          const tabTutorData = sessionStorage.getItem('tabTutorData');
          if (tabTutorData) {
            try {
              const parsedTutor = JSON.parse(tabTutorData);
              if (parsedTutor && parsedTutor.id) {
                console.log('[TUTOR DASHBOARD] ✅ Backend returned user mismatch, using sessionStorage data');
                if (isMounted) {
                  setTutorUser(parsedTutor);
                  markActiveUserType("tutor");
                  // Restore to localStorage
                  storeAuthState("tutor", null, parsedTutor);
                }
                return;
              }
            } catch (e) {
              // If parsing fails, continue to error handling
            }
          }
        }

        // If we get here, it means the user is not a tutor or there was an error
        const message = String(error?.message ?? "").toLowerCase();
        const unauthorized = message.includes("401") || message.includes("unauthorized");
        const userMismatch = message.includes("403") || message.includes("user mismatch");

        // If it's a user mismatch, we already handled it above, so just return
        if (userMismatch) {
          return;
        }

        if (unauthorized) {
          clearAuthState("tutor");
          if (isMounted) navigate("/tutor/login", { replace: true });
          return;
        }

        console.error('[TUTOR DASHBOARD] Error fetching tutor:', error);
        // Don't navigate on other errors - just log
      }
    };

    fetchTutor();

    return () => {
      isMounted = false;
    };
  }, [navigate]); // ✅ Only run once on mount - don't re-run on every render

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
      // Refresh to show expired status
      fetchAcceptedQueries();
    };

    const queryExpiredHandler = (data: any) => {
      console.log("Query expired (another tutor selected):", data);
      // Refresh to show expired status with OK button
      fetchAcceptedQueries();
    };

    // ✅ Listen for session-ended events to refresh queries (remove ended sessions)
    const sessionEndedHandler = (data: any) => {
      console.log("Session ended, refreshing queries:", data);
      // Refresh both available and accepted queries to remove ended sessions
      fetchQueries();
      fetchAcceptedQueries();
    };

    // 🔥 NEW: Listen for coin updates when student enters session
    const coinsUpdatedHandler = async (data: any) => {
      console.log('[🪙 COINS] 🔔 Coin update event received from backend:', data);
      console.log('[🪙 COINS] 🔔 Current tutorUser:', { id: tutorUser?.id, coins: tutorUser?.tokens });
      
      // ✅ CRITICAL: Double-check user ID matches before updating
      if (tutorUser && data.userId === tutorUser.id && data.newBalance !== undefined) {
        // ✅ STEP 2: Use hardRefreshTutorCoins helper instead of session-specific endpoint
        // Compute actualTutorId the same way as refreshCoinsFromBackend
        const tabTutorId = sessionStorage.getItem('tabTutorId');
        const actualTutorId = tabTutorId ? Number(tabTutorId) : tutorUser.id;
        
        console.log('[🪙 COINS] 🚀 Socket event received, calling hardRefreshTutorCoins:', {
          sessionId: data.sessionId,
          tutorId: actualTutorId,
        });
        
        // Use /api/me as source of truth (works reliably on Kubernetes)
        await hardRefreshTutorCoins(actualTutorId);
      } else {
        console.log('[🪙 COINS] ⚠️ Coin update event ignored - user ID mismatch or missing data:', {
          eventUserId: data.userId,
          currentTutorId: tutorUser?.id,
          hasBalance: data.newBalance !== undefined,
          tutorUserExists: !!tutorUser,
        });
      }
    };

    socket.on("new-query", newQueryHandler);
    socket.on("query-assigned", queryAssignedHandler);
    socket.on("query-not-selected", queryNotSelectedHandler);
    socket.on("query-expired", queryExpiredHandler);
    socket.on("session-created", sessionCreatedHandler);
    socket.on("session-ended", sessionEndedHandler);
    socket.on("coins-updated", coinsUpdatedHandler);  // 🔥 NEW

    // ✅ STEP 1: Reusable helper to hard refresh tutor coins from /api/me
    // This is the primary source of truth for tutor coin updates on Kubernetes
    const hardRefreshTutorCoins = async (actualTutorId: number): Promise<void> => {
      try {
        const url = `${apiPath("/me")}?expectedUserId=${actualTutorId}`;
        const res = await api.get(url);
        const u = res?.user;
        
        // ✅ CRITICAL: Only update if the API returns the same tutor ID
        if (u && u.id === actualTutorId && u.tokens !== undefined) {
          // Use functional update to get latest tutorUser state
          setTutorUser((currentTutor: any) => {
            const updatedTutor = {
              ...currentTutor,
              id: u.id, // Ensure we use the correct ID from API
              tokens: u.tokens,
              coins: u.tokens,
            };
            
            // Update localStorage
            storeAuthState("tutor", null, updatedTutor);
            
            // ✅ CRITICAL: Always update sessionStorage with correct tutor ID
            sessionStorage.setItem('tabTutorId', u.id.toString());
            sessionStorage.setItem('tabTutorData', JSON.stringify(updatedTutor));
            
            // Dispatch event to update TutorNavbar
            window.dispatchEvent(new CustomEvent('token-update', {
              detail: { userId: u.id, tokens: u.tokens, coins: u.tokens, tutorCoins: u.tokens }
            }));
            
            console.log('[🪙 COINS][tutor] hardRefreshTutorCoins updated to', u.tokens);
            
            return updatedTutor;
          });
        }
      } catch (err) {
        console.warn('[🪙 COINS][tutor] hardRefreshTutorCoins failed:', err);
        // Do not throw - fail silently
      }
    };

    // ✅ Refresh coins from backend when dashboard loads
    const refreshCoinsFromBackend = async () => {
      if (!tutorUser?.id) return;
      
      // ✅ CRITICAL: Use sessionStorage tutor ID if available (more reliable)
      const tabTutorId = sessionStorage.getItem('tabTutorId');
      const actualTutorId = tabTutorId ? Number(tabTutorId) : tutorUser.id;
      
      await hardRefreshTutorCoins(actualTutorId);
    };

    // Refresh coins on mount and every 30 seconds (slow refresh)
    refreshCoinsFromBackend();
    const coinsInterval = setInterval(refreshCoinsFromBackend, 30000);
    
    // ✅ CRITICAL: Fast fallback polling (every 2 seconds) to catch coin updates even if socket event is missed
    // This ensures tutor coins update within 2-3 seconds even if socket event is not received
    // ✅ STEP 3: Simplified to always use /api/me via hardRefreshTutorCoins (works reliably on Kubernetes)
    const fastCoinsInterval = setInterval(async () => {
      if (!tutorUser?.id) return;
      
      try {
        // Use sessionStorage tutor ID if available
        const tabTutorId = sessionStorage.getItem('tabTutorId');
        const actualTutorId = tabTutorId ? Number(tabTutorId) : tutorUser.id;
        
        // Always use /api/me as source of truth (no session-specific endpoint logic)
        await hardRefreshTutorCoins(actualTutorId);
      } catch (err) {
        // Silently fail - don't spam console with polling errors
      }
    }, 2000); // Poll every 2 seconds

    return () => {
      if (tutorUser?.id) socket.emit("leave-tutor-room", tutorUser.id);
      socket.off("new-query", newQueryHandler);
      socket.off("query-assigned", queryAssignedHandler);
      socket.off("query-not-selected", queryNotSelectedHandler);
      socket.off("query-expired", queryExpiredHandler);
      socket.off("session-created", sessionCreatedHandler);
      socket.off("session-ended", sessionEndedHandler);
      socket.off("coins-updated", coinsUpdatedHandler);  // 🔥 NEW
      clearInterval(coinsInterval);
      clearInterval(fastCoinsInterval); // Clear fast polling interval
    };
  }, [tutorUser?.id, tutorUser, fetchQueries]); // Removed acceptedQueries - using ref instead to prevent constant re-renders

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

  // ✅ Dismiss expired query
  const handleDismissExpired = async (queryId: string) => {
    try {
      if (!tutorUser?.id) {
        alert("Please log in again");
        return;
      }
      const response = await api.post(apiPath("/queries/tutor/dismiss-expired"), {
        queryId,
        tutorId: tutorUser.id.toString(),
      });
      if (response?.ok) {
        // Remove from accepted queries list
        setAcceptedQueries((prevQueries) =>
          prevQueries.filter((item) => item.id !== queryId)
        );
      }
    } catch (error: any) {
      console.error("Error dismissing expired query:", error);
      alert("Failed to dismiss expired query. Please try again.");
    }
  };

  // ✅ Query handlers
  const handleAcceptQuery = async (queryId: string) => {
    try {
      if (!tutorUser?.id) {
        navigate("/tutor/login");
        return;
      }
      
      // ✅ CRITICAL: Double-check tutor ID from sessionStorage to ensure we use the correct one
      // This prevents using wrong ID from localStorage
      const tabTutorId = sessionStorage.getItem('tabTutorId');
      const tabTutorData = sessionStorage.getItem('tabTutorData');
      let actualTutorId = tutorUser.id;
      
      if (tabTutorId && tabTutorData) {
        try {
          const parsedTutor = JSON.parse(tabTutorData);
          if (parsedTutor && parsedTutor.id && parsedTutor.id.toString() === tabTutorId) {
            actualTutorId = parsedTutor.id;
            // If IDs don't match, update tutorUser state
            if (actualTutorId !== tutorUser.id) {
              console.warn('[TUTOR DASHBOARD] 🚨 Tutor ID mismatch detected, using sessionStorage ID:', {
                localStorageId: tutorUser.id,
                sessionStorageId: actualTutorId,
                action: 'Using sessionStorage ID for query acceptance'
              });
              setTutorUser(parsedTutor);
            }
          }
        } catch (e) {
          // If parsing fails, use tutorUser.id
        }
      }
      
      const response = await api.post(apiPath("/queries/accept"), {
        queryId,
        tutorId: actualTutorId.toString(),
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
      // Check if it's an authentication error
      const errorMessage = error?.response?.data?.message || error?.message || "";
      if (errorMessage.includes("Authentication required") || errorMessage.includes("log in") || error?.response?.status === 401) {
        alert("Authentication error: Please log out and log back in as a tutor to accept queries.");
      } else {
        alert("Failed to accept query. Please try again.");
      }
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
    if (!tutorUser?.id) {
      alert("Your session expired. Please login again.");
      navigate("/tutor/login", { replace: true });
      return;
    }

    try {
      // Check if session already exists
      const sessionId = query.sessionId;
      
      if (sessionId) {
        // Session already exists, just navigate to it
        console.log('[TUTOR DASHBOARD] Session already exists, navigating to:', sessionId);
        navigate(`/session/${sessionId}`, {
          state: { userType: "tutor", user: tutorUser },
          replace: false,
        });
        return;
      }

      // ✅ CRITICAL: Double-check tutor ID from sessionStorage to ensure we use the correct one
      const tabTutorId = sessionStorage.getItem('tabTutorId');
      const tabTutorData = sessionStorage.getItem('tabTutorData');
      let actualTutorId = tutorUser.id;
      let actualTutorUser = tutorUser;
      
      if (tabTutorId && tabTutorData) {
        try {
          const parsedTutor = JSON.parse(tabTutorData);
          if (parsedTutor && parsedTutor.id && parsedTutor.id.toString() === tabTutorId) {
            actualTutorId = parsedTutor.id;
            actualTutorUser = parsedTutor;
            // If IDs don't match, update tutorUser state
            if (actualTutorId !== tutorUser.id) {
              console.warn('[TUTOR DASHBOARD] 🚨 Tutor ID mismatch detected, using sessionStorage ID:', {
                localStorageId: tutorUser.id,
                sessionStorageId: actualTutorId,
                action: 'Using sessionStorage ID for session creation'
              });
              setTutorUser(parsedTutor);
            }
          }
        } catch (e) {
          // If parsing fails, use tutorUser.id
        }
      }
      
      // Create new session - ✅ CRITICAL: Use actualTutorId from sessionStorage
      console.log('[TUTOR DASHBOARD] Creating session with tutor ID:', actualTutorId, 'queryId:', query.id);
      const response = await api.post(apiPath("/queries/session"), {
        queryId: query.id,
        tutorId: actualTutorId,
        studentId: query.studentId,
      });
      
      const newSessionId = response?.sessionId;
      if (newSessionId) {
        console.log('[TUTOR DASHBOARD] ✅ Session created successfully:', {
          sessionId: newSessionId,
          tutorId: actualTutorId,
          queryId: query.id,
          studentId: query.studentId
        });
        navigate(`/session/${newSessionId}`, {
          state: { userType: "tutor", user: actualTutorUser },
          replace: false,
        });
      } else {
        console.error('[TUTOR DASHBOARD] No sessionId in response:', response);
        alert("Failed to start session. Session ID not received.");
      }
    } catch (error: any) {
      console.error("Error starting session:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to start session. Please try again.";
      alert(errorMessage);
    }
  };

  const handleRejoinSession = async (query: StudentQuery) => {
    if (!tutorUser?.id) {
      alert("Your session expired. Please login again.");
      navigate("/tutor/login", { replace: true });
      return;
    }
    if (!query?.sessionId) {
      alert("Session ID not found. Please try again.");
      return;
    }
    
    console.log('[🪙 COINS] Tutor rejoining session (no API call, using cached coins)'); 
    
    // Navigate with existing tutor data (coins will refresh when clicking "Start Session Timer")
    navigate(`/session/${query.sessionId}`, {
      state: { userType: "tutor", user: tutorUser },
      replace: false,
    });
  };

  const handleLogout = useCallback(async () => {
    try {
      if (tutorUser?.id) socket.emit("leave-tutor-room", tutorUser.id);
      await api.post(apiPath("/logout"), {});
    } catch (error) {
      console.error("Tutor logout error:", error);
    } finally {
      // ✅ CRITICAL: Clear ALL auth states to prevent showing old user data
      clearAllAuthStates();
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
        background: "linear-gradient(135deg, #37353E 0%, #44444E 50%, #37353E 100%)",
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
                                  minWidth: "100px",
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
                                Accept
                              </Button>
                              <Button
                                variant="outlined"
                                onClick={() => handleDeclineQuery(query.id)}
                                sx={{
                                  border: "1px solid rgba(239, 68, 68, 0.5)",
                                  color: "#715A5A",
                                  borderRadius: "12px",
                                  px: 3,
                                  py: 1,
                                  minWidth: "100px",
                                  textTransform: "none",
                                  fontWeight: 600,
                                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                                  "&:hover": {
                                    transform: "scale(1.05)",
                                    borderColor: "#715A5A",
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
                      const isExpired = acceptanceStatus === 'EXPIRED';
                      // Allow starting session if selected and query is ASSIGNED (case-insensitive check)
                      const queryStatusUpper = (query.status || '').toUpperCase();
                      const canStartSession = isSelected && (
                        queryStatusUpper === 'ASSIGNED' || 
                        queryStatusUpper === 'ACCEPTED' || 
                        queryStatusUpper === 'IN-SESSION' ||
                        query.acceptedTutorId === tutorUser?.id?.toString()
                      );
                      // Same condition as student side: can rejoin if session exists and not ended
                      const canRejoinSession = !!query.sessionId && query.sessionStatus !== 'ended';
                      
                      return (
                        <Card
                          key={query.id}
                          variant="outlined"
                          sx={{ 
                            borderRadius: 2, 
                            backgroundColor: isExpired
                              ? "rgba(239, 68, 68, 0.1)"
                              : isSelected 
                              ? "rgba(16, 185, 129, 0.15)"
                              : "rgba(255, 193, 7, 0.15)",
                            border: isExpired
                              ? "1px solid rgba(239, 68, 68, 0.3)"
                              : isSelected
                              ? "1px solid rgba(16, 185, 129, 0.3)"
                              : "1px solid rgba(255, 193, 7, 0.3)",
                          }}
                        >
                          <CardContent>
                            <Stack spacing={0.5}>
                              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                {query.studentName || query.student_name || `Student ${query.studentId || ''}`}
                              </Typography>
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
                              {isExpired && (
                                <Chip 
                                  label="This query has expired" 
                                  color="error" 
                                  size="small" 
                                  sx={{ mt: 1, alignSelf: "flex-start" }}
                                />
                              )}
                              {isExpired ? (
                                <Button
                                  variant="contained"
                                  color="error"
                                  onClick={() => handleDismissExpired(query.id)}
                                  sx={{
                                    mt: 1,
                                    borderRadius: "12px",
                                    px: 3,
                                    py: 1.2,
                                    textTransform: "none",
                                    fontWeight: 600,
                                    fontSize: "0.95rem",
                                  }}
                                >
                                  OK
                                </Button>
                              ) : isSelected && canStartSession && !canRejoinSession ? (
                                <Button
                                  variant="contained"
                                  sx={{ 
                                    mt: 2,
                                    background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                                    borderRadius: "12px",
                                    px: 3,
                                    py: 1.2,
                                    width: "150px",
                                    height: "40px",
                                    // alignSelf: "center",
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
                                  }}
                                  onClick={() => handleStartSession(query)}
                                >
                                  Start Session
                                </Button>
                              ) : canRejoinSession ? (
                                <Button
                                  variant="contained"
                                  onClick={() => handleRejoinSession(query)}
                                  sx={{ 
                                    mt: 2,
                                    background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                                    borderRadius: "12px",
                                    px: 3,
                                    py: 1.2,
                                    minWidth: "180px",
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
                                  }}
                                >
                                  Rejoin Session
                                </Button>
                              ) : query.sessionStatus === 'ended' ? (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: "italic" }}>
                                  Session Completed
                                </Typography>
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


