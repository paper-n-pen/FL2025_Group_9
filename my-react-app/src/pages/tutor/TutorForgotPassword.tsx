// my-react-app/src/pages/tutor/TutorForgotPassword.tsx

import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const TutorForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setMessage('Password reset link sent to your email!');
      setLoading(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
      backgroundAttachment: "fixed",
    }}>
      <div className="card max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{
            backgroundColor: "#1e293b",
            border: "1px solid rgba(148, 163, 184, 0.2)",
          }}>
            <span className="text-2xl font-bold" style={{ color: "#f1f5f9" }}>MT</span>
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#f1f5f9" }}>Reset Password</h1>
          <p style={{ color: "#cbd5e1" }}>
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {message ? (
          <div className="text-center">
            <div className="px-4 py-3 rounded-lg text-sm mb-6" style={{
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              color: "#34d399",
            }}>
              {message}
            </div>
            <Link to="/tutor/login" className="btn btn-primary">
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "#f1f5f9" }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="Enter your email"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link to="/tutor/login" className="text-sm hover:underline" style={{ color: "#cbd5e1" }}>
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TutorForgotPassword;
