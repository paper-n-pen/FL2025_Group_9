// src/pages/student/StudentRegister.tsx
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
import { apiPath } from "../../config";
import api from "../../lib/api";
import { markActiveUserType, storeAuthState } from "../../utils/authStorage";

type RegistrationForm = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export default function StudentRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegistrationForm>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prevForm: RegistrationForm) => ({
      ...prevForm,
      [event.target.name]: event.target.value,
    }));
    setError(""); // Clear error on input change
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    // Client-side validation
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    try {
      console.log("Submitting registration form...");
      await api.post(apiPath("/register"), {
        username: form.name,
        email: form.email,
        password: form.password,
        user_type: "student",
      });

      await api.post(apiPath("/login"), {
        email: form.email,
        password: form.password,
        role: "student",
      });

      const me = await api.get(apiPath("/me"));
      const user = me?.user;
      if (!user) {
        throw new Error("Unable to verify new student account");
      }

      const resolvedRole = (user.role || user.userType || "student").toLowerCase();
      const typeKey = resolvedRole === "tutor" ? "tutor" : "student";
      const normalizedUser = {
        ...user,
        userType: typeKey,
        name: user.name || user.username,
        username: user.username || user.name || user.email,
      };

      storeAuthState(typeKey, null, normalizedUser);
      markActiveUserType(typeKey);

      setSuccess("✅ Account created! Taking you to your dashboard...");
      navigate(`/${typeKey}/dashboard`, { replace: true });
    } catch (err: unknown) {
      console.error("Registration error:", err);
      // Show exact server error message
      const errorMessage =
        err instanceof Error ? err.message : "Registration failed. Please try again.";
      const friendlyMessage = /registered as student/i.test(errorMessage)
        ? "This email already has a student account. Please sign in or reset your password."
        : errorMessage;
      setError(`❌ ${friendlyMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        backgroundAttachment: "fixed",
        p: 2,
      }}
    >
      <Paper
        elevation={6}
        sx={{
          p: 6,
          borderRadius: 4,
          textAlign: "center",
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        }}
      >
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Student Registration
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={3}>
          Create your account to start learning with expert tutors.
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Already have a tutor profile? You can reuse the same email to open a student account.
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Full Name"
            name="name"
            value={form.name}
            onChange={handleChange}
            margin="normal"
            required
            disabled={loading}
          />
          <TextField
            fullWidth
            label="Email Address"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            margin="normal"
            required
            disabled={loading}
          />
          <TextField
            fullWidth
            label="Password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            margin="normal"
            required
            disabled={loading}
            helperText="Must be at least 6 characters"
          />
          <TextField
            fullWidth
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange}
            margin="normal"
            required
            disabled={loading}
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2, textAlign: "left" }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {success}
            </Alert>
          )}

          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{ 
              mt: 3,
              background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
              borderRadius: "16px",
              px: 4,
              py: 1.5,
              minWidth: "200px",
              textTransform: "none",
              fontWeight: 600,
              fontSize: "1rem",
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
                Creating Account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </Box>

        <Typography variant="body2" mt={3}>
          Already have an account?{" "}
          <MuiLink component={Link} to="/student/login">
            Sign in here
          </MuiLink>
        </Typography>
      </Paper>
    </Box>
  );
}
