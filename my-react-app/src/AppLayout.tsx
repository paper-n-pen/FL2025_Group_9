import { useLocation, useNavigate, Outlet } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { apiPath } from "./config";
import api from "./lib/api";
import type { StoredUser } from "./utils/authStorage";

export default function AppLayout() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await api.get<{ user?: StoredUser }>(apiPath("/me"));
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

  return <Outlet />;
}
