// my-react-app/src/pages/student/ForgotPassword.tsx

import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const ForgotPassword = () => {
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
      background: "linear-gradient(135deg, #37353E 0%, #44444E 50%, #37353E 100%)",
      backgroundAttachment: "fixed",
    }}>
      <div className="card max-w-md w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#D3DAD9" }}>Reset Password</h1>
          <p style={{ color: "#b8c0bf" }}>
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {message ? (
          <div className="text-center">
            <div className="px-4 py-3 rounded-lg text-sm mb-6" style={{
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              color: "#8a6f6f",
            }}>
              {message}
            </div>
            <Link to="/student/login" className="btn btn-primary">
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "#D3DAD9" }}>
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
          <Link to="/student/login" className="text-sm hover:underline" style={{ color: "#b8c0bf" }}>
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
