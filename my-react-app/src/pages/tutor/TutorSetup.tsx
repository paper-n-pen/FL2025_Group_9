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
  Alert,
  CircularProgress,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { storeAuthState, markActiveUserType } from "../../utils/authStorage";

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
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    education: "",
    specialties: [] as string[],
    price_per_hour: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(""); // Clear error on input change
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    // Client-side validation
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      console.log("Submitting tutor registration...");
      const user = await api.post('/api/auth/register', {
        role: "tutor",
        name: form.name,
        email: form.email,
        password: form.password,
        education: form.education || undefined,
        subjects: form.specialties.length > 0 ? form.specialties : undefined,
        price_per_hour: form.price_per_hour ? Number(form.price_per_hour) : undefined,
      });

      console.log("Tutor registration successful:", user);

      // Store auth state
      storeAuthState("tutor", null, {
        id: user.id,
        username: user.name,
        email: user.email,
        userType: user.role,
      });
      markActiveUserType("tutor");

      setSuccess("✅ Account created successfully!");
      setTimeout(() => {
        navigate("/tutor/dashboard", { replace: true });
      }, 1000);
    } catch (err: any) {
      console.error("Registration error:", err);
      // Show exact server error message
      const errorMessage = err.message || "Registration failed. Please try again.";
      setError(`❌ ${errorMessage}`);
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
          <TextField
            fullWidth
            label="Education Background"
            name="education"
            value={form.education}
            onChange={handleChange}
            margin="normal"
            disabled={loading}
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
            disabled={loading}
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
            label="Price per Hour ($)"
            name="price_per_hour"
            type="number"
            value={form.price_per_hour}
            onChange={handleChange}
            margin="normal"
            disabled={loading}
            inputProps={{ min: 0, step: 0.01 }}
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
