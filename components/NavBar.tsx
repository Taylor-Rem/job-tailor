// components/NavBar.tsx
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';

export default function NavBar() {
  const { userId, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <nav className="navbar">
      <Link href="/" className="navbar-brand">
        Job Tailor
      </Link>
      <div className="navbar-links">
        <Link href="/" className="link">
          Home
        </Link>
        <Link href="/jobs" className="link">
                View Jobs
            </Link>
        {userId ? (
          <>
            <Link href="/upload" className="link">
                Upload Resume
            </Link>
            <Link href="/account" className="link">
              Account
            </Link>
            <button onClick={handleLogout} className="link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              Log Out
            </button>
          </>
        ) : (
          <>
            <Link href="/signup" className="link">
              Sign Up
            </Link>
            <Link href="/login" className="link">
              Log In
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}