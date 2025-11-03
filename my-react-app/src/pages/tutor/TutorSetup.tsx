// src/pages/tutor/TutorSetup.tsx
import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Link as MuiLink,
  Chip,
  Autocomplete,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

axios.defaults.withCredentials = true;

// ✅ Predefined list of specialties tutors can choose from
const specialtiesList = [
  "Java", "Python", "JavaScript", "C++", "Data Structures", "Algorithms", "Web Development", "Machine Learning",
  "Calculus", "Linear Algebra", "Statistics", "Probability", "Discrete Math", "Geometry",
  "Mechanics", "Thermodynamics", "Electromagnetism", "Quantum Physics", "Optics",
  "Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry", "Biochemistry"
];

export default function TutorSetup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    education: "",
    specialties: [] as string[],
    rate: "",
  });
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      await axios.post("http://localhost:3000/api/register", {
        username: form.fullName,
        email: form.email,
        password: form.password,
        user_type: "tutor",
        education: form.education,
        specialties: form.specialties.join(", "),
        rate_per_10_min: form.rate,
      });

      navigate("/tutor/login");
    } catch (err: any) {
      console.error("Registration failed:", err);
      setError(
        err.response?.data?.message ||
          "Registration failed. Please try again."
      );
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
          maxWidth: 500,
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        }}
      >
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Tutor Registration
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={3}>
          Create your tutor account and start sharing your expertise.
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Full Name"
            name="fullName"
            value={form.fullName}
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
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            margin="normal"
            required
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
          />
          <TextField
            fullWidth
            label="Education Background"
            name="education"
            value={form.education}
            onChange={handleChange}
            margin="normal"
          />

          {/* ✅ Autocomplete with search + multiple selections */}
          <Autocomplete
            multiple
            freeSolo // allows tutors to type custom specialties
            options={specialtiesList}
            value={form.specialties}
            onChange={(event, newValue) => {
              setForm({ ...form, specialties: newValue });
            }}
            renderTags={(value: readonly string[], getTagProps) =>
              value.map((option: string, index: number) => (
                <Chip
                  variant="outlined"
                  color="primary"
                  label={option}
                  {...getTagProps({ index })}
                  key={option}
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Specialties"
                placeholder="Select or type specialties..."
                margin="normal"
              />
            )}
            sx={{ mt: 1, mb: 2 }}
          />

          <TextField
            fullWidth
            label="Rate per 10 minutes ($)"
            name="rate"
            type="number"
            value={form.rate}
            onChange={handleChange}
            margin="normal"
          />

          <Button
            fullWidth
            type="submit"
            variant="contained"
            color="success"
            size="large"
            sx={{ mt: 3 }}
          >
            Create Account
          </Button>

          {error && (
            <Typography color="error" mt={2}>
              {error}
            </Typography>
          )}
        </Box>

        <Typography variant="body2" mt={3}>
          Already have an account?{" "}
          <MuiLink component={Link} to="/tutor/login">
            Sign in here
          </MuiLink>
        </Typography>

        <Typography variant="body2" mt={1}>
          ←{" "}
          <MuiLink component={Link} to="/" underline="hover">
            Back to Home
          </MuiLink>
        </Typography>
      </Paper>
    </Box>
  );
}
