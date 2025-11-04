// src/pages/tutor/TutorLogin.tsx
import React, { useState } from "react";
import {
  Box, Typography, TextField, Button, Link as MuiLink, Paper, Alert, CircularProgress
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { storeAuthState, markActiveUserType } from "../../utils/authStorage";

export default function TutorLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(""); // Clear error on input change
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      console.log("Attempting login...");
      const user = await api.post('/api/auth/login', {
        email: form.email,
        password: form.password,
      });

      console.log("Login successful! User:", user);

      // Store auth state
      storeAuthState("tutor", null, {
        id: user.id,
        username: user.name,
        email: user.email,
        userType: user.role,
      });
      markActiveUserType("tutor");

      // Navigate based on role
      if (user.role?.toLowerCase() === "student") {
        console.log("Navigating to /student/dashboard");
        navigate("/student/dashboard", { replace: true });
      } else {
        console.log("Navigating to /tutor/dashboard");
        navigate("/tutor/dashboard", { replace: true });
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      // Show exact server error message
      const errorMessage = err.message || "Login failed. Please try again.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", width: "100vw", display: "flex",
      justifyContent: "center", alignItems: "center",
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
      backgroundAttachment: "fixed",
      p: 2 }}>
      <Paper elevation={6} sx={{ p: 6, borderRadius: 4, textAlign: "center",
        width: "100%", maxWidth: 420, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>Tutor Login</Typography>
        <Typography variant="body1" color="text.secondary" mb={3}>
          Welcome back! Please sign in to your account.
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <TextField fullWidth label="Email" name="email" type="email" value={form.email}
            onChange={handleChange} margin="normal" required disabled={loading} />
          <TextField fullWidth label="Password" name="password" type="password"
            value={form.password} onChange={handleChange} margin="normal" required disabled={loading} />

          {error && (
            <Alert severity="error" sx={{ mt: 2, textAlign: "left" }}>
              {error}
            </Alert>
          )}

          <Button 
            type="submit" 
            variant="contained" 
            disabled={loading} 
            sx={{ 
              mt: 3,
              background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
              borderRadius: "24px",
              px: 3,
              py: 1.2,
              minWidth: "140px",
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.95rem",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              "&:hover": {
                transform: "scale(1.05)",
                boxShadow: "0 4px 12px rgba(79, 70, 229, 0.4)",
                background: "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)",
              },
              "&:disabled": {
                background: "rgba(79, 70, 229, 0.5)",
              },
            }}
          >
            {loading ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} color="inherit" />
                Logging in...
              </>
            ) : (
              "Login"
            )}
          </Button>
        </Box>

        <Typography variant="body2" mt={3}>
          Don't have an account?{" "}
          <MuiLink component={Link} to="/tutor/setup">Sign up here</MuiLink>
        </Typography>
      </Paper>
    </Box>
  );
}
