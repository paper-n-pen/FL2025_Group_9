import { useLocation, useNavigate, Outlet } from "react-router-dom";
import axios from "axios";
import React, { useEffect, useState } from "react";

export default function AppLayout() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

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

  useEffect(() => {
    if (!loading && !user) {
      // ✅ Detect if the user was trying to access a tutor route
      const wantsTutorArea = location.pathname.startsWith("/tutor");
      const redirectTo = wantsTutorArea ? "/tutor/login" : "/student/login";
      navigate(redirectTo, { replace: true });
    }
  }, [loading, user, location.pathname, navigate]);

  if (loading) return null; // or a spinner

  return <Outlet />;
}
