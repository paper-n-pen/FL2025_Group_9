// src/theme.ts
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: "#4f46e5", // Indigo
      light: "#6366f1",
      dark: "#4338ca",
    },
    secondary: {
      main: "#10b981", // Emerald green
      light: "#34d399",
      dark: "#059669",
    },
    background: {
      default: "#0f172a", // Dark slate
      paper: "#1e293b", // Slate 800
    },
    text: {
      primary: "#f1f5f9", // Slate 100
      secondary: "#cbd5e1", // Slate 300
    },
    divider: "rgba(148, 163, 184, 0.2)", // Slate 400 with opacity
  },
  typography: {
    fontFamily: "'Inter', 'Roboto', 'Helvetica', 'Arial', sans-serif",
    allVariants: {
      color: "#f1f5f9",
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'linear-gradient(to bottom right, #1e293b, #0f172a)',
          border: '1px solid rgba(148, 163, 184, 0.1)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'linear-gradient(to bottom right, #1e293b, #0f172a)',
          border: '1px solid rgba(148, 163, 184, 0.1)',
        },
      },
    },
  },
});

export default theme;
