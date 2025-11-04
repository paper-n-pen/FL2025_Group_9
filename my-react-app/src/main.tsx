// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider, CssBaseline } from "@mui/material";
import MainRouter from "./MainRouter";
import theme from "./theme";
import "./index.css";
import axios from "axios";
import { BACKEND_ORIGIN } from "./config";

// ✅ Configure Axios globally
axios.defaults.baseURL = BACKEND_ORIGIN;          // backend API origin (supports env + proxies)
axios.defaults.withCredentials = true;            // send cookies on every request
axios.defaults.headers.common["Content-Type"] = "application/json";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />  {/* resets browser defaults and applies MUI baseline */}
      <MainRouter />
    </ThemeProvider>
  </React.StrictMode>
);
