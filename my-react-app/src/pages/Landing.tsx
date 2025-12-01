// src/pages/Landing.tsx
import React from "react";
import { Box, Typography, Button, Stack, Grid, Card, CardContent, Container } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { motion } from "framer-motion";

export default function Landing() {
  const features = [
    {
      title: "Real-Time Tutoring",
      description: "Connect instantly with expert tutors for immediate help and personalized learning experiences.",
      items: ["Live Sessions", "Instant Matching", "Subject Experts", "24/7 Availability"]
    },
    {
      title: "Interactive Learning",
      description: "Collaborate with visual tools and shared NotePad for seamless communication and effective learning experiences.",
      items: ["NotePad", "Video Call", "Live Chat", "Notes"]
    },
    {
      title: "Subject Matching",
      description: "Find tutors specialized in your exact subject and topic with our intelligent matching system.",
      items: ["Subject Matching", "Topic Filtering", "Rating System", "Session History"]
    },
    {
      title: "Session Management",
      description: "Track sessions, rates, and ratings all in one place for seamless learning management.",
      items: ["Session Tracking", "Rate Management", "Rating System", "History"]
    }
  ];

  const scrollToFeatures = () => {
    const featuresSection = document.getElementById('features-section');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        background: "linear-gradient(135deg, #0a0a0f 0%, #1a1a24 30%, #0f0f1a 60%, #0a0a0f 100%)",
        backgroundAttachment: "fixed",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background TUTOR Logo - Diagonal, Transparent */}
      <Box
        sx={{
          position: "absolute",
          top: "25%",
          left: "50%",
          transform: "translate(-50%, -50%) rotate(-15deg)",
          zIndex: 0,
          opacity: 0.15,
          pointerEvents: "none",
        }}
      >
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: "8rem", md: "12rem", lg: "16rem" },
            fontWeight: 900,
            letterSpacing: "0.02em",
            color: "#ffffff",
            textTransform: "uppercase",
            fontFamily: "'Roboto Condensed', 'Arial Narrow', 'Helvetica Neue Condensed', 'Helvetica', sans-serif",
            lineHeight: 1,
            fontStretch: "condensed",
            whiteSpace: "nowrap",
          }}
        >
          MICROTUTOR
        </Typography>
      </Box>

      {/* Main Content Container */}
      <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1 }}>
        {/* Header/Navigation */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            py: 3,
            px: { xs: 2, md: 4 },
          }}
        >
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              color: "#ffffff",
              fontFamily: "'Roboto Condensed', sans-serif",
              fontSize: { xs: "1.5rem", md: "2rem" },
            }}
          >
            MicroTutor
          </Typography>
          <Button
            onClick={scrollToFeatures}
            sx={{
              color: "#ffffff",
              textTransform: "none",
              px: 3,
              fontWeight: 600,
              fontSize: "1rem",
              "&:hover": {
                background: "rgba(139, 92, 246, 0.1)",
              },
            }}
          >
            Features
          </Button>
        </Box>

        {/* Hero Section */}
        <Box
          sx={{
            textAlign: "center",
            py: { xs: 6, md: 10 },
            px: { xs: 2, md: 4 },
          }}
        >
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: "2.5rem", md: "4rem", lg: "5rem" },
              fontWeight: 900,
              lineHeight: 1.2,
              color: "#ffffff",
              mb: 3,
              fontFamily: "'Roboto Condensed', 'Arial Narrow', 'Helvetica Neue Condensed', 'Helvetica', sans-serif",
              letterSpacing: "0.05em",
              fontStretch: "condensed",
            }}
          >
            Instant Tutoring. Real Results.
            <br />
            <Box
              component="span"
              sx={{
                background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Guaranteed.
            </Box>
          </Typography>
          <Typography
            variant="h6"
            sx={{
              fontSize: { xs: "1rem", md: "1.25rem" },
              color: "#cbd5e1",
              maxWidth: "800px",
              mx: "auto",
              mb: 4,
              lineHeight: 1.6,
            }}
          >
            Connect with expert tutors instantly. Post your question, get matched with specialized tutors, and start learning in real-time with interactive whiteboards and live chat.
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            justifyContent="center"
            alignItems="center"
          >
            <Button
              component={RouterLink}
              to="/student/login"
              variant="contained"
              sx={{
                background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                color: "#ffffff",
                px: 4,
                py: 1.5,
                fontSize: "1rem",
                fontWeight: 600,
                textTransform: "none",
                borderRadius: "12px",
                "&:hover": {
                  background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                  transform: "translateY(-2px)",
                  boxShadow: "0 8px 24px rgba(139, 92, 246, 0.4)",
                },
              }}
            >
              I am a Student
            </Button>
            <Button
              component={RouterLink}
              to="/tutor/login"
              variant="outlined"
              sx={{
                borderColor: "rgba(255, 255, 255, 0.3)",
                color: "#ffffff",
                px: 4,
                py: 1.5,
                fontSize: "1rem",
                fontWeight: 600,
                textTransform: "none",
                borderRadius: "12px",
                "&:hover": {
                  borderColor: "#8b5cf6",
                  background: "rgba(139, 92, 246, 0.1)",
                },
              }}
            >
              I am a Tutor
            </Button>
          </Stack>
        </Box>

        {/* Features Section */}
        <Box id="features-section" sx={{ py: 8, px: { xs: 2, md: 4 } }}>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 2,
              justifyContent: "space-between",
            }}
          >
            {features.map((feature, index) => (
              <Box
                key={index}
                sx={{
                  width: { xs: "100%", sm: "45%" },
                  flexShrink: 0,
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card
                    sx={{
                      height: "100%",
                      background: "linear-gradient(to bottom right, #1a1a24, #0f0f1a)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "16px",
                      transition: "transform 0.2s ease, box-shadow 0.2s ease",
                      "&:hover": {
                        transform: "translateY(-4px)",
                        boxShadow: "0 12px 32px rgba(139, 92, 246, 0.2)",
                        borderColor: "rgba(139, 92, 246, 0.3)",
                      },
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 700,
                          color: "#ffffff",
                          mb: 2,
                          fontSize: "1.5rem",
                        }}
                      >
                        {feature.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "#cbd5e1",
                          lineHeight: 1.5,
                          mb: 3,
                          fontSize: "0.95rem",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {feature.description}
                      </Typography>
                      {feature.items && (
                        <Stack spacing={1}>
                          {feature.items.map((item, idx) => (
                            <Box
                              key={idx}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                color: "#cbd5e1",
                                fontSize: "0.9rem",
                              }}
                            >
                              <Box
                                sx={{
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "50%",
                                  background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
                                  mr: 1.5,
                                }}
                              />
                              {item}
                            </Box>
                          ))}
                        </Stack>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </Box>
            ))}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
