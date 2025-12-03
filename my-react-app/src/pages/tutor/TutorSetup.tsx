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
  Alert,
  CircularProgress,
} from "@mui/material";
import Autocomplete, {
  type AutocompleteRenderInputParams,
  type AutocompleteRenderGetTagProps,
} from "@mui/material/Autocomplete";
import { Link, useNavigate } from "react-router-dom";
import { apiPath } from "../../config";
import api, { type JsonValue } from "../../lib/api";
import { storeAuthState, markActiveUserType } from "../../utils/authStorage";
import type { MeResponse, StoredUser } from "../../utils/authStorage";

// ✅ Predefined list of specialties tutors can choose from
const specialtiesList = [
  "Java", "Python", "JavaScript", "C++", "Data Structures", "Algorithms", "Web Development", "Machine Learning",
  "Calculus", "Linear Algebra", "Statistics", "Probability", "Discrete Math", "Geometry",
  "Mechanics", "Thermodynamics", "Electromagnetism", "Quantum Physics", "Optics",
  "Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry", "Biochemistry"
];

type TutorSetupForm = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  education: string;
  specialties: string[];
  rate_per_10_min: string;
};

export default function TutorSetup() {
  const navigate = useNavigate();
  const [form, setForm] = useState<TutorSetupForm>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    education: "",
    specialties: [],
    rate_per_10_min: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prevForm: TutorSetupForm) => ({
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
      const rawRate = form.rate_per_10_min ? parseFloat(form.rate_per_10_min) : 0;
      const ratePerTen = Number.isFinite(rawRate) ? Number(rawRate.toFixed(2)) : 0;

      const registerPayload: Record<string, JsonValue> = {
        username: form.name,
        email: form.email,
        password: form.password,
        user_type: "tutor",
        specialties: form.specialties,
        rate_per_10_min: ratePerTen,
      };
      if (form.education.trim()) {
        registerPayload.education = form.education.trim();
      }

      await api.post(apiPath("/register"), registerPayload);

      await api.post(apiPath("/login"), {
        email: form.email,
        password: form.password,
        role: "tutor",
      });

      const me = await api.get<MeResponse>(apiPath("/me"));
      const user: StoredUser | null | undefined = me?.user;
      if (!user) {
        throw new Error("Unable to verify new tutor account");
      }

      const resolvedRole = (user.role || user.userType || "tutor").toLowerCase();
      const typeKey = resolvedRole === "student" ? "student" : "tutor";
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
      const friendlyMessage = /registered as tutor/i.test(errorMessage)
        ? "This email already has a tutor profile. Please sign in instead."
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
        <Typography variant="body2" color="text.secondary" mb={3}>
          Already a student here? You can reuse that email for your tutor profile.
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
            onChange={(
              _event: React.SyntheticEvent,
              newValue: string[]
            ) => {
              setForm((prevForm: TutorSetupForm) => ({
                ...prevForm,
                specialties: newValue,
              }));
            }}
            disabled={loading}
            renderTags={(
              value: readonly string[],
              getTagProps: AutocompleteRenderGetTagProps
            ) =>
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
            renderInput={(params: AutocompleteRenderInputParams) => (
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
            name="rate_per_10_min"
            type="number"
            value={form.rate_per_10_min}
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
