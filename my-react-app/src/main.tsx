// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider, CssBaseline } from "@mui/material";
import MainRouter from "./MainRouter";
import theme from "./theme";
import "./index.css";
import axios from "axios";

// ✅ Configure Axios globally (matches fetch client defaults)
const metaEnv = (import.meta as unknown as {
  env?: Record<string, string | undefined>;
}).env;

const API_BASE = metaEnv?.VITE_API_URL ?? "";

axios.defaults.baseURL = API_BASE || ""; // relative URL fallback for proxy setups
axios.defaults.withCredentials = true; // send cookies on every request
axios.defaults.headers.common["Content-Type"] = "application/json";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* resets browser defaults and applies MUI baseline */}
      <MainRouter />
    </ThemeProvider>
  </React.StrictMode>
);
