import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <Link href="/" className="navbar-brand">
        Resume Generator
      </Link>
      <div className="navbar-links">
        {user ? (
          <button onClick={logout}>Log Out</button>
        ) : (
          <Link href="/auth">
            <button>Login/Signup</button>
          </Link>
        )}
      </div>
    </nav>
  );
}