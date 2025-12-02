// src/pages/tutor/TutorProfileView.tsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Button,
  Divider,
  Chip,
  Stack,
} from "@mui/material";
import api from "../../lib/api";
import { apiPath } from "../../config";

interface TutorProfile {
  id?: number;
  name?: string;
  bio?: string;
  education?: string;
  specialties?: string[];
  rate?: number;
  averageRating?: number;
  ratingsCount?: number;
}

export default function TutorProfileView() {
  const { tutorId } = useParams<{ tutorId: string }>();
  const navigate = useNavigate();

  const [tutor, setTutor] = useState<TutorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch tutor info
  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<TutorProfile | null>(
          apiPath(`/queries/tutors/${tutorId}`)
        );
        setTutor(data ?? null);
      } catch (error) {
        console.error("Failed to fetch tutor info:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [tutorId]);

  // Loading
  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>Loading tutor information...</Typography>
      </Box>
    );
  }

  // No tutor found
  if (!tutor) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography color="error">Tutor not found.</Typography>
        <Button variant="contained" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </Box>
    );
  }

  // Main view
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        color: "white",
        p: 2,
      }}
    >
      <Card
        sx={{
          borderRadius: 3,
          maxWidth: 650,
          width: "95%",
          p: 3,
          backgroundColor: "rgba(255, 255, 255, 0.06)",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
        }}
      >
        <CardContent>
          {/* Header: Name + Avatar */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Avatar sx={{ width: 80, height: 80, bgcolor: "primary.main" }}>
              {tutor.name?.[0]?.toUpperCase() || "?"}
            </Avatar>

            <Box>
              <Typography variant="h4" fontWeight={700}>
                {tutor.name}
              </Typography>

              <Typography variant="subtitle1" color="text.secondary">
                Tutor
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 3, borderColor: "rgba(255,255,255,0.2)" }} />

          {/* BIO */}
          <Typography variant="h6" gutterBottom>
            Biography
          </Typography>
          <Typography variant="body1" paragraph>
            {tutor.bio || "This tutor has not added a biography yet."}
          </Typography>

          {/* EDUCATION */}
          <Typography variant="h6" gutterBottom>
            Education
          </Typography>
          <Typography
            variant="body1"
            paragraph
            color={tutor.education ? "inherit" : "text.secondary"}
          >
            {tutor.education || "Education not specified"}
          </Typography>

          {/* SPECIALTIES */}
          <Typography variant="h6" gutterBottom>
            Specialties
          </Typography>
          {tutor.specialties?.length > 0 ? (
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
              {tutor.specialties.map((spec: string, index: number) => (
                <Chip
                  key={`${spec}-${index}`}
                  label={spec}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              No specialties listed.
            </Typography>
          )}

          {/* RATES + RATINGS */}
          <Divider sx={{ my: 3, borderColor: "rgba(255,255,255,0.2)" }} />

          <Typography variant="body1">
            <strong>Rate:</strong>{" "}
            {tutor.rate ? `$${tutor.rate}/10 minutes` : "N/A"}
          </Typography>

          <Typography variant="body1" sx={{ mt: 1, mb: 3 }}>
            <strong>Rating:</strong>{" "}
            {tutor.averageRating
              ? `${tutor.averageRating}/5 (${tutor.ratingsCount} reviews)`
              : "No ratings yet"}
          </Typography>

          {/* BACK BUTTON */}
          <Button
            variant="contained"
            onClick={() => navigate(-1)}
            sx={{
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 600,
              mt: 1,
            }}
          >
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
