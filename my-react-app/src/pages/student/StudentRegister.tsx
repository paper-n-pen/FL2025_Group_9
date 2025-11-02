// Example: src/pages/student/StudentRegister.tsx
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
import { Link } from "react-router-dom";

export default function StudentRegister() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
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

          <Box component="form" noValidate autoComplete="off">
            <TextField
              fullWidth
              label="Full Name"
              name="name"
              value={form.name}
              onChange={handleChange}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Email Address"
              name="email"
              value={form.email}
              onChange={handleChange}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Confirm Password"
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              margin="normal"
            />

            <Button
              fullWidth
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
