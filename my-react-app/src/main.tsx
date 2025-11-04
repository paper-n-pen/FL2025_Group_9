// src/main.tsx
import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider, CssBaseline } from "@mui/material";
import MainRouter from "./MainRouter";
import theme from "./theme";
import "./index.css";
import axios from "axios";
import api from "./lib/api";

// ✅ Configure Axios globally (for non-auth routes that still use axios)
const apiBase = import.meta.env.VITE_API_URL || "";
axios.defaults.baseURL = apiBase;
axios.defaults.withCredentials = true;
axios.defaults.headers.common["Content-Type"] = "application/json";

// Health check on app mount
function AppHealthCheck() {
  useEffect(() => {
    api.get('/api/health')
      .then((data) => console.log('✅ API Health:', data))
      .catch((err) => console.error('❌ API Health check failed:', err));
  }, []);
  return null;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppHealthCheck />
      <MainRouter />
    </ThemeProvider>
  </React.StrictMode>
);
