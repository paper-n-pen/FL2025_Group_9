// my-react-app/src/Login.tsx

// import { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import axios, { isAxiosError } from 'axios';

// interface LoginResponse {
//   token: string;
// }

// function Login() {
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [error, setError] = useState('');
//   const navigate = useNavigate(); // <-- add this

//   const handleLogin = async (e: React.FormEvent) => {
//     e.preventDefault();
//     try {
//       const res = await axios.post<LoginResponse>('/api/login', { email, password });
//       const token = res.data.token;
//       localStorage.setItem('token', token);
//       navigate('/dashboard'); // <-- redirect after successful login
//     } catch (err) {
//       if (isAxiosError(err)) {
//         setError(err.response?.data?.message || 'Login failed.');
//       } else {
//         setError('An unexpected error occurred.');
//       }
//     }
//   };

//   return (
//     <form onSubmit={handleLogin}>
//       <input
//         type="email"
//         placeholder="Email"
//         value={email}
//         onChange={e => setEmail(e.target.value)}
//         required
//       />
//       <input
//         type="password"
//         placeholder="Password"
//         value={password}
//         onChange={e => setPassword(e.target.value)}
//         required
//       />
//       <button type="submit">Login</button>
//       {error && <p style={{ color: 'red' }}>{error}</p>}
//     </form>
//   );
// }

// export default Login;

// src/pages/Login.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios, { isAxiosError } from "axios";
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Avatar,
  Divider,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { apiPath } from "./config";

interface LoginResponse {
  token: string;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
  const res = await axios.post<LoginResponse>(apiPath("/login"), { email, password });
      const token = res.data.token;
      localStorage.setItem("token", token);
      navigate("/dashboard");
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
        minHeight: "100vh",
        background: "linear-gradient(to bottom right, #f5f7ff, #e8f0ff)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        py: 8,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={6}
          sx={{
            p: 5,
            borderRadius: 4,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Header */}
          <Avatar sx={{ bgcolor: "primary.main", width: 60, height: 60, mb: 2 }}>
            <LockOutlinedIcon fontSize="large" />
          </Avatar>

          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Welcome Back
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center" mb={3}>
            Log in to continue your learning journey
          </Typography>
          <Divider sx={{ mb: 3, width: "100%" }} />

          {/* Form */}
          <Box
            component="form"
            onSubmit={handleLogin}
            sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 3 }}
          >
            <TextField
              label="Email"
              variant="outlined"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Password"
              variant="outlined"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
            />

            <Button
              variant="contained"
              color="primary"
              size="large"
              type="submit"
              sx={{
                py: 1.2,
                fontWeight: "bold",
                borderRadius: 2,
              }}
            >
              Login
            </Button>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </Box>

          {/* Optional Link */}
          <Typography variant="body2" color="text.secondary" mt={3}>
            Don’t have an account?{" "}
            <Button
              variant="text"
              size="small"
              onClick={() => navigate("/register")}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Register
            </Button>
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
