import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';

export default function Login() {
  const [identifier, setIdentifier] = useState(''); // Renamed from email to identifier
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }), // Use identifier
      });
      const data = await response.json();
      if (response.ok) {
        login(data.user_id);
        setMessage(`Logged in! Welcome, user ${data.user_id}`);
        router.push('/');
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setMessage(`Network error: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="full-height" style={{ paddingTop: '80px' }}>
      <form onSubmit={handleLogin} className="card form">
        <h1 className="title">Log In</h1>
        <input
          type="text" // Changed from email to text
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Email or Username"
          className="input"
          style={{ marginBottom: '1em' }}
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="input"
          style={{ marginBottom: '1em' }}
          required
        />
        <button type="submit" disabled={loading} className="button">
          {loading ? 'Logging In...' : 'Log In'}
        </button>
        {message && <p className="message">{message}</p>}
      </form>
    </div>
  );
}