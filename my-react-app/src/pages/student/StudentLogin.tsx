// src/pages/student/StudentLogin.tsx
import React, { useState } from "react";
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Link as MuiLink,
  Paper,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

axios.defaults.withCredentials = true; // 👈 enable cookie sending globally

export default function StudentLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await axios.post(
        "http://localhost:3000/api/login",
        form,
        { withCredentials: true } // 👈 include cookies
      );

      console.log("Login success:", res.data);

      const { user } = res.data;
      if (!user) throw new Error("Missing user data");

      localStorage.setItem("user", JSON.stringify(user));

      if (user.userType === "student") navigate("/student/dashboard");
      else if (user.userType === "tutor") navigate("/tutor/dashboard");
      else navigate("/");
    } catch (err: any) {
      console.error("Login failed:", err);
      setError(err.response?.data?.message || "Login failed. Please try again.");
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(to bottom right, #f5f7ff, #e8f0ff)",
      }}
    >
      <Container maxWidth="sm">
        <Paper elevation={6} sx={{ p: 6, borderRadius: 4, textAlign: "center" }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Student Login
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={3}>
            Welcome back! Please log in to your account.
          </Typography>

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email"
              name="email"
              value={form.email}
              onChange={handleChange}
              margin="normal"
              required
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
            />

            <Button
              fullWidth
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              sx={{ mt: 3 }}
            >
              Login
            </Button>

            {error && (
              <Typography color="error" mt={2}>
                {error}
              </Typography>
            )}
          </Box>

          <Typography variant="body2" mt={3}>
            Don't have an account?{" "}
            <MuiLink component={Link} to="/student/register">
              Sign up here
            </MuiLink>
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
