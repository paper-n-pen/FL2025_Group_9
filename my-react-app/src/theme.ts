// src/theme.ts
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: "#8b5cf6", // Purple accent
      light: "#a78bfa",
      dark: "#7c3aed",
    },
    secondary: {
      main: "#6366f1", // Indigo accent
      light: "#818cf8",
      dark: "#4f46e5",
    },
    background: {
      default: "#0a0a0f", // Almost black
      paper: "#1a1a24", // Dark purple-gray
    },
    text: {
      primary: "#ffffff", // White
      secondary: "#cbd5e1", // Light gray
    },
    divider: "rgba(255, 255, 255, 0.1)", // White with opacity
  },
  typography: {
    fontFamily: "'Inter', 'Roboto', 'Helvetica', 'Arial', sans-serif",
    allVariants: {
      color: "#ffffff",
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
          backgroundColor: "#8b5cf6", // Purple
        },
        standardError: {
          backgroundColor: "#7c3aed", // Darker purple
        },
        standardInfo: {
          backgroundColor: "#6366f1", // Indigo
        },
        standardWarning: {
          backgroundColor: "#a78bfa", // Lighter purple
        },
        filledSuccess: {
          backgroundImage: "linear-gradient(135deg, #8b5cf6, #a78bfa)",
          color: "#ffffff",
        },
        filledError: {
          backgroundImage: "linear-gradient(135deg, #7c3aed, #8b5cf6)",
          color: "#ffffff",
        },
        filledInfo: {
          backgroundImage: "linear-gradient(135deg, #6366f1, #818cf8)",
          color: "#ffffff",
        },
        filledWarning: {
          backgroundImage: "linear-gradient(135deg, #a78bfa, #c4b5fd)",
          color: "#ffffff",
        },
        icon: {
          color: "inherit",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'linear-gradient(to bottom right, #1a1a24, #0f0f1a)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'linear-gradient(to bottom right, #1a1a24, #0f0f1a)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
    MuiSnackbar: {
      defaultProps: {
        disableWindowBlurListener: true,
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: "12px",
          transition: "all 0.3s ease",
          fontWeight: 600,
        },
        contained: {
          background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
          color: "#ffffff",
          boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
          "&:hover": {
            background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
            transform: "translateY(-2px)",
            boxShadow: "0 8px 24px rgba(139, 92, 246, 0.4)",
          },
          "&:disabled": {
            background: "rgba(139, 92, 246, 0.5)",
            color: "rgba(255, 255, 255, 0.5)",
          },
        },
        outlined: {
          borderColor: "rgba(255, 255, 255, 0.3)",
          color: "#ffffff",
          "&:hover": {
            borderColor: "#8b5cf6",
            background: "rgba(139, 92, 246, 0.1)",
            transform: "translateY(-2px)",
            boxShadow: "0 4px 12px rgba(139, 92, 246, 0.2)",
          },
        },
        text: {
          color: "#ffffff",
          "&:hover": {
            background: "rgba(139, 92, 246, 0.1)",
            transform: "translateY(-1px)",
          },
        },
      },
    },
  },
});

export default theme;
