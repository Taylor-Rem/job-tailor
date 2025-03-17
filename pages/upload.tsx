// pages/upload.tsx
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { userId } = useAuth();
  const router = useRouter();

  if (!userId) {
    router.push('/login');
    return null;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setMessage('Please select a file');
      return;
    }

    setLoading(true);
    setMessage('');

    const reader = new FileReader();
    reader.onload = async () => {
      const base64String = (reader.result as string).split(',')[1];
      try {
        const response = await fetch('/api/resumes/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, resume: base64String }),
        });
        const data = await response.json();
        if (response.ok) {
          setMessage(`Resume uploaded! Resume ID: ${data.resume_id}`);
        } else {
          setMessage(`Error: ${data.error}`);
        }
      } catch (err) {
        setMessage(`Network error: ${(err as Error).message}`); // Use err here
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="full-height" style={{ paddingTop: '80px' }}>
      <form onSubmit={handleUpload} className="card form">
        <h1 className="title">Upload Resume</h1>
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="file-input"
        />
        <button type="submit" disabled={loading} className="button">
          {loading ? 'Uploading...' : 'Upload'}
        </button>
        {message && <p className="message">{message}</p>}
      </form>
    </div>
  );
}