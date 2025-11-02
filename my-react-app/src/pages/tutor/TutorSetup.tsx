// src/pages/tutor/TutorSetup.tsx
import React, { useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Chip,
  Link as MuiLink,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

export default function TutorSetup() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    education: "",
    specialties: [] as string[],
    ratePer10Min: "",
  });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // List of selectable specialties
  const availableSpecialties = [
    "Math",
    "Physics",
    "Biology",
    "Chemistry",
    "English",
    "History",
    "Computer Science",
    "Economics",
    "Writing",
    "Test Prep",
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSpecialtyToggle = (specialty: string) => {
    setFormData((prev) => {
      const alreadySelected = prev.specialties.includes(specialty);
      return {
        ...prev,
        specialties: alreadySelected
          ? prev.specialties.filter((s) => s !== specialty)
          : [...prev.specialties, specialty],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      const res = await axios.post("/api/register", {
        name: formData.fullName,
        email: formData.email,
        password: formData.password,
        user_type: "tutor",
        education: formData.education,
        specialties: formData.specialties.join(", "),
        rate_per_10_min: formData.ratePer10Min,
      });

      if (res.status === 200 || res.status === 201) {
        navigate("/tutor/dashboard");
      }
    } catch (err: any) {
      console.error(err);
      setError("Server error. Please try again.");
    }
  };

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        py: 8,
      }}
    >
      <Paper
        elevation={6}
        sx={{
          p: 6,
          borderRadius: 4,
          width: "100%",
          maxWidth: 500,
          textAlign: "center",
          boxShadow: 4,
        }}
      >
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Tutor Registration
        </Typography>
        <Typography color="text.secondary" mb={4}>
          Create your tutor account and start sharing your expertise.
        </Typography>

        <Box component="form" onSubmit={handleSubmit} textAlign="left">
          <TextField
            fullWidth
            margin="normal"
            label="Full Name"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            required
          />
          <TextField
            fullWidth
            margin="normal"
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <TextField
            fullWidth
            margin="normal"
            label="Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
          <TextField
            fullWidth
            margin="normal"
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
          />

          {/* Education */}
          <TextField
            fullWidth
            margin="normal"
            label="Education Background"
            name="education"
            value={formData.education}
            onChange={handleChange}
          />

          {/* ---------- Specialties Selector ---------- */}
          <Box mt={3}>
            <Typography fontWeight="medium" mb={1}>
              Specialties
            </Typography>
            <Autocomplete
              multiple
              freeSolo
              options={[
                "Math",
                "Physics",
                "Biology",
                "Chemistry",
                "English",
                "History",
                "Computer Science",
                "Economics",
                "Writing",
                "Test Prep",
              ]}
              value={formData.specialties}
              onChange={(_, newValue) =>
                setFormData((prev) => ({
                  ...prev,
                  specialties: newValue,
                }))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Enter or select specialties"
                  placeholder="e.g. Algebra, Biology, Essay Writing"
                  fullWidth
                />
                )}
                sx={{
                  mb: 2,
                  backgroundColor: "white",
                  borderRadius: 1,
                }}
              />
            </Box>

          {/* Rate per 10 minutes */}

          <TextField
            fullWidth
            margin="normal"
            label="Rate per 10 minutes ($)"
            name="ratePer10Min"
            type="number"
            value={formData.ratePer10Min}
            onChange={handleChange}
          />

          {error && (
            <Typography color="error" variant="body2" mt={1}>
              {error}
            </Typography>
          )}

          <Button
            fullWidth
            variant="contained"
            color="success"
            size="large"
            sx={{ mt: 3, mb: 2 }}
            type="submit"
          >
            Create Account
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary">
          Already have an account?{" "}
          <MuiLink component={Link} to="/tutor/login">
            Sign in here
          </MuiLink>
        </Typography>
        <MuiLink component={Link} to="/" underline="none" sx={{ display: "block", mt: 2 }}>
          ← Back to Home
        </MuiLink>
      </Paper>
    </Box>
  );
}
