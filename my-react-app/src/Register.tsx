//my-react-app/src/Register.tsx

import { useState, type FormEvent, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { storeAuthState, markActiveUserType } from './utils/authStorage';
import type { SupportedUserType, StoredUser } from './utils/authStorage';
import { apiPath } from './config';
import api from './lib/api';

interface RegisterResponse {
  token?: string | null;
  user?: StoredUser | null;
}

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
  const res = await api.post<RegisterResponse>(apiPath('/register'), { username, email, password });
  const { token, user } = res ?? {};

      if (token && user) {
        const normalizedType = (user.userType || 'student') as SupportedUserType;
        storeAuthState(normalizedType, token, user);
        markActiveUserType(normalizedType);
        navigate(normalizedType === 'tutor' ? '/tutor/dashboard' : '/student/dashboard');
        return;
      }

      setSuccess('Registration successful! Please log in.');
      setError('');
      setTimeout(() => navigate('/login'), 1000);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || 'Registration failed');
      } else {
        setError('An unexpected error occurred.');
      }
      setSuccess('');
    }
  };

  const handleUsernameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setUsername(event.target.value);
  };

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
  };

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  return (
    <form onSubmit={handleRegister} style={{ maxWidth: 400, margin: '0 auto' }}>
      <h2>Register</h2>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={handleUsernameChange}
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={handleEmailChange}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={handlePasswordChange}
        required
      />
      <button type="submit">Register</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}
    </form>
  );
}

export default Register;
