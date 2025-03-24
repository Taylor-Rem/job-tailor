import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';

export default function Account() {
  const { userId } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      router.push('/login');
    } else {
      const fetchUserData = async () => {
        try {
          const emailRes = await fetch('/api/users/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId }),
          });
          const emailData = await emailRes.json();
          if (emailRes.ok) setEmail(emailData.email);
          else throw new Error(emailData.error);

          const resumeRes = await fetch('/api/resumes/view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId }),
          });
          const resumeData = await resumeRes.json();
          if (resumeRes.ok) setResumeUrl(resumeData.url);
          else if (resumeRes.status !== 404) throw new Error(resumeData.error);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load account data');
        } finally {
          setLoading(false);
        }
      };
      fetchUserData();
    }
  }, [userId, router]);

  const handleDeleteResume = async () => {
    if (!resumeUrl) return;
    try {
      const res = await fetch('/api/resumes/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (res.ok) setResumeUrl(null);
      else throw new Error('Failed to delete resume');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete resume');
    }
  };

  if (!userId) return null;

  return (
    <div className="full-height" style={{ paddingTop: '80px' }}>
      <div className="card">
        <h1 className="title">Account</h1>
        {loading ? (
          <p className="message">Loading...</p>
        ) : error ? (
          <p className="message">{error}</p>
        ) : (
          <>
            <p className="message">User ID: {userId}</p>
            <p className="message">Email: {email}</p>
            {resumeUrl ? (
              <>
                <p className="message">
                  <a href={resumeUrl} target="_blank" rel="noopener noreferrer" className="link">
                    View Uploaded Resume
                  </a>
                </p>
                <button onClick={handleDeleteResume} className="button">
                  Delete Resume
                </button>
              </>
            ) : (
              <p className="message">No resume uploaded yet.</p>
            )}
            <Link href="/upload" className="link">
              Upload a Resume
            </Link>
          </>
        )}
      </div>
    </div>
  );
}