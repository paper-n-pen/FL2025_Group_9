// src/pages/student/StudentRegister.tsx
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
import { apiPath } from "../../config";

export default function StudentRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (form.password !== form.confirmPassword) {
      setMessage("❌ Passwords do not match.");
      return;
    }

    try {
      console.log("Submitting registration form...");
      const res = await axios.post(apiPath("/register"), {
        username: form.name,
        email: form.email,
        password: form.password,
        user_type: "student",
      });
      console.log("Response:", res.data);

      setMessage("✅ Account created successfully!");
      setTimeout(() => navigate("/student/login"), 1500);
    } catch (err: any) {
      console.error("Error registering:", err);
      setMessage("❌ Registration failed. Please try again.");
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
        background: "linear-gradient(to bottom right, #f5f7ff, #e8f0ff)",
        overflowX: "hidden",
        py: 6,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={6}
          sx={{
            p: 6,
            borderRadius: 4,
            textAlign: "center",
          }}
        >
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Student Registration
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={3}>
            Create your account to start learning.
          </Typography>

          <Box
            component="form"
            noValidate
            autoComplete="off"
            onSubmit={handleSubmit}
          >
            <TextField
              fullWidth
              label="Full Name"
              name="name"
              value={form.name}
              onChange={handleChange}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Email Address"
              name="email"
              value={form.email}
              onChange={handleChange}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Confirm Password"
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              margin="normal"
              required
            />

            {message && (
              <Typography
                variant="body2"
                color={
                  message.startsWith("✅") ? "success.main" : "error.main"
                }
                mt={2}
              >
                {message}
              </Typography>
            )}

            <Button
              fullWidth
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              sx={{ mt: 3 }}
            >
              Create Account
            </Button>
          </Box>

          <Typography variant="body2" mt={3}>
            Already have an account?{" "}
            <MuiLink component={Link} to="/student/login">
              Sign in here
            </MuiLink>
          </Typography>

          <MuiLink
            component={Link}
            to="/"
            underline="none"
            sx={{ display: "block", mt: 2 }}
          >
            ← Back to Home
          </MuiLink>
        </Paper>
      </Container>
    </Box>
  );
}
