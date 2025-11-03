// src/pages/student/StudentLogin.tsx
import React, { useState } from "react";
import {
  Box, Typography, TextField, Button, Link as MuiLink, Paper
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { SOCKET_ENDPOINT } from "../../socket";
import { storeAuthState, markActiveUserType } from "../../utils/authStorage";

axios.defaults.withCredentials = true;

export default function StudentLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await axios.post(`${SOCKET_ENDPOINT}/api/login`, form, { withCredentials: true });

      const { data } = await axios.get(`${SOCKET_ENDPOINT}/api/me`, { withCredentials: true });
      const user = data?.user;
      if (!user) throw new Error("Missing user after verification");

      storeAuthState("student", null, user);
      markActiveUserType("student");

      if (user.userType?.toLowerCase() === "tutor") navigate("/tutor/dashboard", { replace: true });
      else navigate("/student/dashboard", { replace: true });
    } catch (err: any) {
      console.error("Login failed:", err);
      setError(err.response?.data?.message || "Login failed. Please try again.");
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", width: "100vw", display: "flex",
      justifyContent: "center", alignItems: "center",
      background: "linear-gradient(to bottom right, #f5f7ff, #e8f0ff)", p: 2 }}>
      <Paper elevation={6} sx={{ p: 6, borderRadius: 4, textAlign: "center",
        width: "100%", maxWidth: 420, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>Student Login</Typography>
        <Typography variant="body1" color="text.secondary" mb={3}>
          Welcome back! Please log in to your account.
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <TextField fullWidth label="Email" name="email" value={form.email}
            onChange={handleChange} margin="normal" required />
          <TextField fullWidth label="Password" name="password" type="password"
            value={form.password} onChange={handleChange} margin="normal" required />

          <Button fullWidth type="submit" variant="contained" color="primary" size="large" sx={{ mt: 3 }}>
            Login
          </Button>

          {error && <Typography color="error" mt={2}>{error}</Typography>}
        </Box>

        <Typography variant="body2" mt={3}>
          Don’t have an account?{" "}
          <MuiLink component={Link} to="/student/register">Sign up here</MuiLink>
        </Typography>
      </Paper>
    </Box>
  );
}
