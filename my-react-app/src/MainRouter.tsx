// src/MainRouter.tsx
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import AppLayout from "./AppLayout";
import Chatbot from "./components/Chatbot";

// Lazy imports for pages
const Landing           = lazy(() => import("./pages/Landing"));
const StudentLogin      = lazy(() => import("./pages/student/StudentLogin"));
const TutorLogin        = lazy(() => import("./pages/tutor/TutorLogin"));
const StudentRegister   = lazy(() => import("./pages/student/StudentRegister"));
const TutorSetup        = lazy(() => import("./pages/tutor/TutorSetup"));  // acts as tutor registration/setup
const StudentDashboard  = lazy(() => import("./pages/student/StudentDashboard"));
const TutorDashboard    = lazy(() => import("./pages/tutor/TutorDashboard"));
const TutorProfile      = lazy(() => import("./pages/tutor/TutorProfile"));
const SessionRoom       = lazy(() => import("./pages/SessionRoom"));

export default function MainRouter() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={null}>
          <Routes>
            {/* ---------- Public Routes ---------- */}
            <Route path="/" element={<Landing />} />

            {/* Student auth routes */}
            <Route path="/student/login" element={<StudentLogin />} />
            <Route path="/student/register" element={<StudentRegister />} />

            {/* Tutor auth/setup routes */}
            <Route path="/tutor/login" element={<TutorLogin />} />
            <Route path="/tutor/setup" element={<TutorSetup />} />

            {/* ---------- Protected Routes ---------- */}
            <Route element={<AppLayout />}>
              <Route path="/student/dashboard" element={<StudentDashboard />} />
              <Route path="/tutor/dashboard" element={<TutorDashboard />} />
              <Route path="/tutor/profile" element={<TutorProfile />} />
              <Route path="/session/:sessionId" element={<SessionRoom />} />
            </Route>

            {/* ---------- Fallback ---------- */}
            <Route path="*" element={<Landing />} />
          </Routes>
        </Suspense>
        {/* Chatbot - visible on all pages */}
        <Chatbot />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
