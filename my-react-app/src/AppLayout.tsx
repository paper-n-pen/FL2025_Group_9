// src/AppLayout.tsx
import React from "react";
import { Box, AppBar, Toolbar, Typography, Button, Container } from "@mui/material";
import { Outlet, Link } from "react-router-dom";

export default function AppLayout() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(to bottom right, #f5f7ff, #e8f0ff)",
      }}
    >
      {/* Header */}
      <AppBar
        position="static"
        elevation={0}
        color="transparent"
        sx={{
          backdropFilter: "blur(6px)",
          borderBottom: "1px solid rgba(0,0,0,0.1)",
          py: 1,
        }}
      >
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Box display="flex" alignItems="center" gap={1}>
            <Box
              sx={{
                bgcolor: "primary.main",
                color: "white",
                borderRadius: "50%",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                fontSize: 14,
              }}
            >
              MT
            </Box>
            <Typography variant="h6" fontWeight="bold">
              MicroTutor
            </Typography>
          </Box>
          <Button component={Link} to="/" variant="outlined" size="small">
            Home
          </Button>
        </Toolbar>
      </AppBar>

      {/* Main content area */}
      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          px: 2,
          py: 6,
        }}
      >
        <Container
          maxWidth={false}
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
          }}
        >
          <Outlet /> {/* 👈 THIS is where your StudentLogin / Register / etc. will appear */}
        </Container>
      </Box>
    </Box>
  );
}
