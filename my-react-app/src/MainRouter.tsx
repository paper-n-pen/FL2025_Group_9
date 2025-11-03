// src/MainRouter.tsx
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import AppLayout from "./AppLayout";

const Landing         = lazy(() => import("./pages/Landing"));
const StudentLogin    = lazy(() => import("./pages/student/StudentLogin"));
const TutorLogin      = lazy(() => import("./pages/tutor/TutorLogin"));
const StudentDashboard= lazy(() => import("./pages/student/StudentDashboard"));
const TutorDashboard  = lazy(() => import("./pages/tutor/TutorDashboard"));
const TutorProfile    = lazy(() => import("./pages/tutor/TutorProfile"));
const SessionRoom     = lazy(() => import("./pages/SessionRoom"));

export default function MainRouter() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={null}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/student/login" element={<StudentLogin />} />
            <Route path="/tutor/login" element={<TutorLogin />} />

            {/* Protected under AppLayout */}
            <Route element={<AppLayout />}>
              <Route path="/student/dashboard" element={<StudentDashboard />} />
              <Route path="/tutor/dashboard" element={<TutorDashboard />} />
              <Route path="/tutor/profile" element={<TutorProfile />} />
              <Route path="/session/:sessionId" element={<SessionRoom />} />
            </Route>

            <Route path="*" element={<Landing />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
