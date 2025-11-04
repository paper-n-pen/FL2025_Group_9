import { useLocation, useNavigate, Outlet } from "react-router-dom";
import React, { useEffect, useState } from "react";
import api from "./lib/api";

export default function AppLayout() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await api.get('/api/auth/me');
        console.log("AppLayout: User fetched successfully:", data.user?.role);
        setUser(data.user);
      } catch (err: any) {
        console.error("AppLayout: Failed to fetch user:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      // ✅ Detect if the user was trying to access a tutor route
      // Don't redirect if we're already on a login page
      const isLoginPage = location.pathname.includes("/login") || location.pathname.includes("/register") || location.pathname === "/";
      if (isLoginPage) {
        return; // Don't redirect if already on login/register pages
      }
      const wantsTutorArea = location.pathname.startsWith("/tutor");
      const redirectTo = wantsTutorArea ? "/tutor/login" : "/student/login";
      console.log("AppLayout: No user, redirecting to:", redirectTo);
      navigate(redirectTo, { replace: true });
    } else if (!loading && user) {
      console.log("AppLayout: User authenticated:", user.userType, "on path:", location.pathname);
    }
  }, [loading, user, location.pathname, navigate]);

  if (loading) return null; // or a spinner

  return <Outlet />;
}
