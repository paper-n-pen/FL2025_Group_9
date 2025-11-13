// src/pages/Landing.tsx
import React from "react";
import { Box, Typography, Button, Stack } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export default function Landing() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw", // ✅ full width
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        backgroundAttachment: "fixed",
        textAlign: "center",
      }}
    >
      <Box sx={{ 
        p: 4, 
        borderRadius: 4, 
        bgcolor: "background.paper", 
        backgroundImage: "linear-gradient(to bottom right, #1e293b, #0f172a)",
        boxShadow: 3, 
        maxWidth: 700,
        border: "1px solid rgba(148, 163, 184, 0.1)",
      }}>
        <Typography variant="h3" fontWeight="bold" gutterBottom>
          Welcome to MicroTutor
        </Typography>

        <Typography variant="h6" color="text.secondary" mb={4}>
          Connect with expert tutors or help students master their skills.  
          Choose your path below to get started.
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={3} justifyContent="center">
          <Button
            component={RouterLink}
            to="/student/login"
            variant="contained"
            sx={{ 
              px: 4,
              py: 1.5,
              borderRadius: "16px",
              background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
              minWidth: "180px",
              textTransform: "none",
              fontWeight: 600,
              fontSize: "1rem",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              "&:hover": {
                transform: "scale(1.05)",
                boxShadow: "0 4px 12px rgba(79, 70, 229, 0.4)",
                background: "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)",
              },
            }}
          >
            I'm a Student
          </Button>

          <Button
            component={RouterLink}
            to="/tutor/login"
            variant="outlined"
            sx={{
              px: 4,
              py: 1.5,
              borderRadius: "16px",
              backgroundColor: "rgba(30, 41, 59, 0.5)",
              color: "#f1f5f9",
              border: "1px solid rgba(148, 163, 184, 0.3)",
              minWidth: "180px",
              textTransform: "none",
              fontWeight: 600,
              fontSize: "1rem",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              "&:hover": { 
                transform: "scale(1.05)",
                backgroundColor: "rgba(51, 65, 85, 0.7)", 
                borderColor: "#4f46e5",
                boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)",
              },
            }}
          >
            I'm a Tutor
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
