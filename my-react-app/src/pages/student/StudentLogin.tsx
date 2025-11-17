// src/pages/student/StudentLogin.tsx
import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Link as MuiLink,
  Paper,
  Alert,
  CircularProgress,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import { storeAuthState, markActiveUserType } from "../../utils/authStorage";
import { apiPath } from "../../config";
import api from "../../lib/api";

type FormState = {
  email: string;
  password: string;
};

export default function StudentLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prevForm: FormState) => ({
      ...prevForm,
      [event.target.name]: event.target.value,
    }));
    setError(""); // Clear error on input change
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post(apiPath("/login"), { ...form, role: "student" });

      const data = await api.get(apiPath("/me"));

      const user = data?.user;
      if (!user) {
        throw new Error("Missing user after verification");
      }

      const resolvedRole = (user.role || user.userType || "student").toLowerCase();
      const normalizedUser = {
        ...user,
        userType: resolvedRole,
        name: user.name || user.username,
      };

      storeAuthState("student", null, normalizedUser);
      markActiveUserType("student");

      if (resolvedRole === "tutor") {
        navigate("/tutor/dashboard", { replace: true });
      } else {
        navigate("/student/dashboard", { replace: true });
      }
    } catch (err: unknown) {
      console.error("Login failed:", err);
      // Show exact server error message
      const errorMessage =
        err instanceof Error ? err.message : "Login failed. Please try again.";
      const friendlyMessage = /matching login page/i.test(errorMessage)
        ? "This email is linked to a tutor account. Please use the tutor login page."
        : errorMessage;
      setError(friendlyMessage);
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
        <Typography variant="h4" fontWeight="bold" gutterBottom>Student Login</Typography>
        <Typography variant="body1" color="text.secondary" mb={3}>
          Welcome back! Please log in to your account.
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
          <MuiLink component={Link} to="/student/register">Sign up here</MuiLink>
        </Typography>
      </Paper>
    </Box>
  );
}
