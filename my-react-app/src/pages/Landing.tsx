// src/pages/Landing.tsx
import React from "react";
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Avatar,
  Stack,
} from "@mui/material";
import { Link } from "react-router-dom";
import SchoolIcon from "@mui/icons-material/School";
import MenuBookIcon from "@mui/icons-material/MenuBook";

export default function Landing() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw", // ✅ fills full width of viewport
        background: "linear-gradient(to bottom right, #f5f7ff, #e8f0ff)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        py: 8,
        overflowX: "hidden", // prevents horizontal scrollbars
      }}
    >
      <Container
        maxWidth="lg"
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* ---------- Hero Section ---------- */}
        <Box textAlign="center" mb={8}>
          <Avatar
            sx={{
              bgcolor: "primary.main",
              width: 80,
              height: 80,
              fontSize: 28,
              mx: "auto",
              mb: 3,
              boxShadow: 3,
            }}
          >
            MT
          </Avatar>
          <Typography variant="h2" fontWeight="bold" gutterBottom>
            MicroTutor
          </Typography>
          <Typography
            variant="h6"
            color="text.secondary"
            maxWidth="600px"
            mx="auto"
          >
            Connect with expert tutors for instant, focused learning sessions
          </Typography>
        </Box>

        {/* ---------- Cards ---------- */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={5}
          justifyContent="center"
          alignItems="stretch"
          sx={{ width: "100%", maxWidth: "900px" }} // ✅ balances center column
        >
          {/* Student */}
          <Paper
            elevation={6}
            sx={{
              flex: 1,
              p: 5,
              borderRadius: 4,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Avatar
                sx={{
                  bgcolor: "info.main",
                  width: 64,
                  height: 64,
                  mb: 3,
                  mx: "auto",
                }}
              >
                <MenuBookIcon fontSize="large" />
              </Avatar>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                For Students
              </Typography>
              <Typography variant="body1" color="text.secondary" mb={4}>
                Get instant help with your studies from expert tutors.
              </Typography>
            </Box>
            <Box>
              <Button
                variant="contained"
                color="info"
                fullWidth
                sx={{ mb: 2 }}
                component={Link}
                to="/student/login"
              >
                Login
              </Button>
              <Button
                variant="outlined"
                color="info"
                fullWidth
                component={Link}
                to="/student/register"
              >
                Sign Up
              </Button>
            </Box>
          </Paper>

          {/* Tutor */}
          <Paper
            elevation={6}
            sx={{
              flex: 1,
              p: 5,
              borderRadius: 4,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Avatar
                sx={{
                  bgcolor: "success.main",
                  width: 64,
                  height: 64,
                  mb: 3,
                  mx: "auto",
                }}
              >
                <SchoolIcon fontSize="large" />
              </Avatar>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                For Tutors
              </Typography>
              <Typography variant="body1" color="text.secondary" mb={4}>
                Share your expertise and earn money by helping students.
              </Typography>
            </Box>
            <Box>
              <Button
                variant="contained"
                color="success"
                fullWidth
                sx={{ mb: 2 }}
                component={Link}
                to="/tutor/login"
              >
                Login
              </Button>
              <Button
                variant="outlined"
                color="success"
                fullWidth
                component={Link}
                to="/tutor/setup"
              >
                Sign Up
              </Button>
            </Box>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
