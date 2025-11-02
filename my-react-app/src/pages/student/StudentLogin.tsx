import React, { useState } from "react";
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Link as MuiLink,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import axios, { isAxiosError } from "axios";

interface LoginResponse {
  token: string;
}

export default function StudentLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post<LoginResponse>("/api/login", { email, password });
      const token = res.data.token;
      localStorage.setItem("token", token);
      navigate("/student/dashboard");
    } catch (err) {
      if (isAxiosError(err)) {
        setError(err.response?.data?.message || "Login failed.");
      } else {
        setError("An unexpected error occurred.");
      }
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "calc(100vh - 80px)", // subtract header height
        px: 2,
      }}
    >
      <Paper
        elevation={8}
        sx={{
          p: 5,
          borderRadius: 4,
          width: "100%",
          maxWidth: 420,
          textAlign: "center",
        }}
      >
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Student Login
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Welcome back! Sign in to continue learning.
        </Typography>

        <Box component="form" onSubmit={handleLogin}>
          <TextField
            fullWidth
            margin="normal"
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            fullWidth
            margin="normal"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <Typography color="error" variant="body2" mt={1}>
              {error}
            </Typography>
          )}

          <Button
            fullWidth
            variant="contained"
            color="primary"
            type="submit"
            sx={{ mt: 3, mb: 2 }}
          >
            Sign In
          </Button>
        </Box>

        <MuiLink
          component={Link}
          to="/student/forgot-password"
          underline="hover"
          color="primary"
          display="block"
          mb={2}
        >
          Forgot your password?
        </MuiLink>

        <Typography variant="body2" color="text.secondary">
          Don’t have an account?{" "}
          <MuiLink component={Link} to="/student/register" underline="hover" color="primary">
            Sign up here
          </MuiLink>
        </Typography>

        <MuiLink
          component={Link}
          to="/"
          underline="hover"
          color="primary"
          display="block"
          mt={2}
        >
          ← Back to Home
        </MuiLink>
      </Paper>
    </Box>
  );
}
