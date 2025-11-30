import { useLocation, useNavigate, Outlet } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { apiPath } from "./config";
import api from "./lib/api";
import StudentNavbar from "./components/StudentNavbar";
import TutorNavbar from "./components/TutorNavbar";
import { SessionContextProvider, useSessionContext } from "./contexts/SessionContext";

function NavbarWrapper() {
  const location = useLocation();
  const navigate = useNavigate();
  const { endSessionHandler, dashboardHandler } = useSessionContext();

  const isSessionRoom = location.pathname.startsWith("/session/");
  const isTutorRoute = location.pathname.startsWith("/tutor/");
  const isStudentRoute = location.pathname.startsWith("/student/");

  // 🔥 FIX: Determine which navbar based on route and sessionStorage
  const sessionType = sessionStorage.getItem('activeUserType');
  
  console.log('[APP LAYOUT] Determining navbar:', {
    path: location.pathname,
    sessionType,
    isTutorRoute,
    isStudentRoute,
  });

  const handleDashboardClick = () => {
    if (sessionType === "tutor") {
      navigate("/tutor/dashboard", { replace: false });
    } else {
      navigate("/student/dashboard", { replace: false });
    }
  };

  // Determine which navbar component to use
  if (isSessionRoom) {
    // On session pages: Use sessionStorage to determine which navbar
    if (sessionType === 'tutor') {
      console.log('[APP LAYOUT] ✅ Session page → TutorNavbar');
      return (
        <TutorNavbar
          onEndSessionClick={endSessionHandler || undefined}
          onDashboardClick={dashboardHandler || handleDashboardClick}
          showDashboard={true}
          showLogout={false}
        />
      );
    } else {
      console.log('[APP LAYOUT] ✅ Session page → StudentNavbar');
      return (
        <StudentNavbar
          onEndSessionClick={endSessionHandler || undefined}
          onDashboardClick={dashboardHandler || handleDashboardClick}
          showDashboard={true}
          showLogout={false}
        />
      );
    }
  }

  if (isTutorRoute) {
    console.log('[APP LAYOUT] ✅ Tutor route → TutorNavbar');
    return (
      <TutorNavbar
        showDashboard={true}
        onDashboardClick={handleDashboardClick}
        showLogout={true}
        showProfile={true}
      />
    );
  }

  // Default to student navbar for student routes
  console.log('[APP LAYOUT] ✅ Student route → StudentNavbar');
  return (
    <StudentNavbar
      showDashboard={true}
      onDashboardClick={handleDashboardClick}
      showLogout={true}
    />
  );
}

export default function AppLayout() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await api.get(apiPath("/me"));
        setUser(data?.user ?? null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      const wantsTutorArea = location.pathname.startsWith("/tutor");
      const redirectTo = wantsTutorArea ? "/tutor/login" : "/student/login";
      navigate(redirectTo, { replace: true });
    }
  }, [loading, user, location.pathname, navigate]);

  if (loading) return null; // or a spinner

  return (
    <SessionContextProvider>
      <NavbarWrapper />
      <Outlet />
    </SessionContextProvider>
  );
}
