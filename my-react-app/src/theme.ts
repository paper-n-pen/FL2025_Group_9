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
    MuiAlert: {
      defaultProps: {
        variant: "filled",
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: 12,
          color: "#f8fafc",
          boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
        },
        standardSuccess: {
          backgroundColor: "#2e7d32", // Green
        },
        standardError: {
          backgroundColor: "#d32f2f", // Red
        },
        standardInfo: {
          backgroundColor: "#0288d1", // Blue
        },
        standardWarning: {
          backgroundColor: "#ed6c02", // Orange
        },
        filledSuccess: {
          backgroundImage: "linear-gradient(135deg, #16a34a, #22c55e)",
          color: "#ecfdf5",
        },
        filledError: {
          backgroundImage: "linear-gradient(135deg, #dc2626, #ef4444)",
          color: "#fef2f2",
        },
        filledInfo: {
          backgroundImage: "linear-gradient(135deg, #0ea5e9, #38bdf8)",
          color: "#f0f9ff",
        },
        filledWarning: {
          backgroundImage: "linear-gradient(135deg, #f97316, #fb923c)",
          color: "#fff7ed",
        },
        icon: {
          color: "inherit",
        },
      },
    },
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
    MuiSnackbar: {
      defaultProps: {
        disableWindowBlurListener: true,
      },
    },
  },
});

export default theme;
