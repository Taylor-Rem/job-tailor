import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';

export default function Auth() {
  const { signup: signupFn, login: loginFn } = useAuth();
  const router = useRouter();

  const [signupEmail, setSignupEmail] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupMessage, setSignupMessage] = useState('');

  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginMessage, setLoginMessage] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signupFn(signupEmail, signupUsername, signupPassword);
      setSignupMessage(`User ${signupUsername} created successfully!`);
      setSignupEmail('');
      setSignupUsername('');
      setSignupPassword('');
      router.push('/');
    } catch (error) {
      setSignupMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loginFn(loginIdentifier, loginPassword);
      setLoginMessage('Login successful!');
      setLoginIdentifier('');
      setLoginPassword('');
      router.push('/');
    } catch (error) {
      setLoginMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="container" style={{ paddingTop: '80px' }}>
      <h1>Authentication</h1>
      <div style={{ display: 'flex', gap: '40px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ flex: 1 }}>
          <h2>Sign Up</h2>
          <form onSubmit={handleSignup}>
            <input
              type="email"
              placeholder="Email"
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
              style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px' }}
            />
            <input
              type="text"
              placeholder="Username"
              value={signupUsername}
              onChange={(e) => setSignupUsername(e.target.value)}
              style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px' }}
            />
            <input
              type="password"
              placeholder="Password"
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px' }}
            />
            <button type="submit">Sign Up</button>
          </form>
          {signupMessage && <p>{signupMessage}</p>}
        </div>
        <div style={{ flex: 1 }}>
          <h2>Login</h2>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Email or Username"
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
              style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px' }}
            />
            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px' }}
            />
            <button type="submit">Login</button>
          </form>
          {loginMessage && <p>{loginMessage}</p>}
        </div>
      </div>
    </div>
  );
}