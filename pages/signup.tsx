import { useState } from 'react';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState(0);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, plan }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(`User created! Your user_id is ${data.user_id}`);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="full-height" style={{ paddingTop: '80px' }}>
      <form onSubmit={handleSignup} className="card form">
        <h1 className="title">Sign Up</h1>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="input"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="input"
          required
        />
        <select
          value={plan}
          onChange={(e) => setPlan(Number(e.target.value))}
          className="select"
        >
          <option value={0}>Basic</option>
          <option value={1}>Premium</option>
        </select>
        <button type="submit" disabled={loading} className="button">
          {loading ? 'Signing Up...' : 'Sign Up'}
        </button>
        {message && <p className="message">{message}</p>}
      </form>
    </div>
  );
}