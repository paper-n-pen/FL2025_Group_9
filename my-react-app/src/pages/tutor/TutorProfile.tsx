// src/pages/tutor/TutorProfile.tsx
import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Chip,
  Card,
  CardHeader,
  CardContent,
  TextField,
  Container,
  Stack,
  Divider,
  Snackbar,
  Alert,
  IconButton,
} from "@mui/material";
import type { AlertColor, SnackbarCloseReason } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate } from "react-router-dom";
import {
  getAuthStateForType,
  storeAuthState,
  markActiveUserType,
} from "../../utils/authStorage";
import { apiPath } from "../../config";
import api from "../../lib/api";

export default function TutorProfile() {
  type TutorProfileForm = {
    bio: string;
    education: string;
    specialties: string[];
    ratePer10Min: string;
  };

  const [formData, setFormData] = useState<TutorProfileForm>({
    bio: "",
    education: "",
    specialties: [] as string[],
    ratePer10Min: "",
  });
  const [loading, setLoading] = useState(false);
  type Snack = {
    id: number;
    message: string;
    severity: AlertColor;
    open: boolean;
  };
  const [snacks, setSnacks] = useState<Snack[]>([]);
  const navigate = useNavigate();

  const availableSpecialties = [
    "Java",
    "Python",
    "JavaScript",
    "C++",
    "Data Structures",
    "Algorithms",
    "Web Development",
    "Machine Learning",
    "Calculus",
    "Linear Algebra",
    "Statistics",
    "Probability",
    "Mechanics",
    "Thermodynamics",
    "Electromagnetism",
    "Quantum Physics",
    "Organic Chemistry",
    "Inorganic Chemistry",
    "Physical Chemistry",
    "Biochemistry",
  ];

  useEffect(() => {
    const stored = getAuthStateForType("tutor");
    if (stored.user) {
      markActiveUserType("tutor");
      setFormData({
        bio: stored.user.bio || "",
        education: stored.user.education || "",
        specialties: stored.user.specialties || [],
        ratePer10Min:
          stored.user.ratePer10Min !== undefined &&
          stored.user.ratePer10Min !== null
            ? Number(stored.user.ratePer10Min).toFixed(2)
            : "",
      });
    } else {
      navigate("/tutor/login", { replace: true });
    }
  }, [navigate]);

  const pushSnack = (message: string, severity: AlertColor = "info") => {
    setSnacks((prevSnacks: Snack[]) => [
      ...prevSnacks,
      { id: Date.now() + Math.random(), message, severity, open: true },
    ]);
  };

  const closeSnack = (id: number) => {
    setSnacks((prevSnacks: Snack[]) =>
      prevSnacks.map((snack) =>
        snack.id === id ? { ...snack, open: false } : snack
      )
    );
  };

  const removeSnack = (id: number) => {
    setSnacks((prevSnacks: Snack[]) => prevSnacks.filter((snack) => snack.id !== id));
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    if (name === "ratePer10Min") {
      if (value === "" || /^\d*(?:\.\d{0,2})?$/.test(value)) {
        setFormData((prev: TutorProfileForm) => ({
          ...prev,
          ratePer10Min: value,
        }));
      }
    } else {
      setFormData((prev: TutorProfileForm) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSpecialtyToggle = (specialty: string) => {
    setFormData((prev: TutorProfileForm) => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter((current: string) => current !== specialty)
        : [...prev.specialties, specialty],
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const stored = getAuthStateForType("tutor");
      if (!stored.user) {
        navigate("/tutor/login", { replace: true });
        return;
      }

      const normalizedRate = formData.ratePer10Min
        ? Number(Number(formData.ratePer10Min).toFixed(2))
        : 0;

      await api.put(apiPath("/queries/profile"), {
        ...formData,
        ratePer10Min: normalizedRate,
        userId: stored.user.id,
      });

      const updatedUser = {
        ...stored.user,
        ...formData,
        ratePer10Min: normalizedRate,
      };
      storeAuthState("tutor", stored.token, updatedUser);
      markActiveUserType("tutor");

      pushSnack("Profile updated successfully!", "success");
      setTimeout(() => navigate("/tutor/dashboard"), 1500);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update profile";
      pushSnack(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        backgroundAttachment: "fixed",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        py: 8,
      }}
    >
      <Container
        maxWidth={false} // 🔥 removes fixed width limits
        sx={{
          width: "100%",
          height: "100%",
          px: { xs: 4, md: 8, lg: 12 }, // consistent side padding
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Header */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          mb={5}
          sx={{ width: "100%" }}
        >
          <Box>
            <Typography variant="h4" fontWeight={800}>
              Tutor Profile
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Update your information to help students find you
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="error"
            onClick={() => navigate("/tutor/dashboard")}
            sx={{
              borderRadius: 2,
              fontWeight: 600,
              textTransform: "none",
              px: 3,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          >
            Back to Dashboard
          </Button>
        </Stack>

        {/* Main Card */}
        <Card
          elevation={6}
          sx={{
            borderRadius: 4,
            width: "100%",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            backgroundColor: "#1e293b",
          }}
        >
          <CardHeader
            title="Edit Your Profile"
            sx={{
              backgroundColor: "#334155",
              py: 2,
              px: 3,
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
            }}
          />
          <Divider />
          <CardContent sx={{ p: 4 }}>
            <Stack
              component="form"
              spacing={4}
              onSubmit={handleSubmit}
              sx={{ mt: 1 }}
            >
              <TextField
                label="Bio"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                multiline
                rows={3}
                fullWidth
                placeholder="Tell students about your teaching experience..."
              />

              <TextField
                label="Education"
                name="education"
                value={formData.education}
                onChange={handleChange}
                fullWidth
                placeholder="e.g., MS in Computer Science"
              />

              <Box>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  mb={1.5}
                >
                  Specialties (Select all that apply)
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {availableSpecialties.map((specialty) => {
                    const selected = formData.specialties.includes(specialty);
                    return (
                      <Chip
                        key={specialty}
                        label={specialty}
                        onClick={() => handleSpecialtyToggle(specialty)}
                        color={selected ? "primary" : "default"}
                        variant={selected ? "filled" : "outlined"}
                        sx={{
                          borderRadius: 2,
                          cursor: "pointer",
                          fontWeight: selected ? 600 : 400,
                        }}
                      />
                    );
                  })}
                </Stack>
                <Typography variant="caption" color="text.secondary" mt={1}>
                  Selected: {formData.specialties.length} specialties
                </Typography>
              </Box>

              <TextField
                label="Rate per 10 minutes ($)"
                name="ratePer10Min"
                type="number"
                value={formData.ratePer10Min}
                onChange={handleChange}
                fullWidth
                inputProps={{ min: "0", step: "0.01", max: "100" }}
              />

              <Stack direction="row" spacing={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => navigate("/tutor/dashboard")}
                  sx={{ borderRadius: 2 }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  type="submit"
                  disabled={loading}
                  sx={{ 
                    background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                    borderRadius: "16px",
                    px: 4,
                    py: 1.5,
                    minWidth: "180px",
                    textTransform: "none",
                    fontWeight: 600,
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
                  {loading ? "Updating..." : "Update Profile"}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Container>

      {/* Snackbars */}
      {snacks.map((snack: Snack) => (
        <Snackbar
          key={snack.id}
          open={snack.open}
          autoHideDuration={2000}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
          onClose={(
            _event: React.SyntheticEvent | Event,
            reason?: SnackbarCloseReason
          ) => {
            if (reason === "clickaway") {
              return;
            }
            closeSnack(snack.id);
          }}
          TransitionProps={{
            onExited: () => removeSnack(snack.id),
          }}
        >
          <Alert
            severity={snack.severity}
            action={
              <IconButton
                size="small"
                aria-label="close"
                color="inherit"
                onClick={() => closeSnack(snack.id)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
            sx={{ boxShadow: 3, borderRadius: 2 }}
          >
            {snack.message}
          </Alert>
        </Snackbar>
      ))}
    </Box>
  );
}
