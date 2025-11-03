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
        background: "linear-gradient(to bottom right, #f5f7ff, #e8f0ff)",
        textAlign: "center",
      }}
    >
      <Box sx={{ p: 4, borderRadius: 4, bgcolor: "white", boxShadow: 3, maxWidth: 700 }}>
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
            color="primary"
            size="large"
            sx={{ px: 5, py: 1.5, borderRadius: 2 }}
          >
            I’m a Student
          </Button>

          <Button
            component={RouterLink}
            to="/tutor/login"
            variant="outlined"
            color="primary"
            size="large"
            sx={{
              px: 5,
              py: 1.5,
              borderRadius: 2,
              backgroundColor: "white",
              ":hover": { backgroundColor: "#eef3ff" },
            }}
          >
            I’m a Tutor
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
