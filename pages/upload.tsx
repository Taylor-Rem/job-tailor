import { useState } from 'react';

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [userId] = useState(1); // Hardcode for now, replace with auth later
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setMessage('Please select a file');

    setLoading(true);
    setMessage('');

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1]; // Remove data URL prefix
      try {
        const response = await fetch('/api/resumes/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, resume: base64 }),
        });
        const data = await response.json();
        if (response.ok) {
          setMessage(`Resume uploaded! Resume ID: ${data.resume_id}`);
        } else {
          setMessage(`Error: ${data.error}`);
        }
      } catch (err) {
        setMessage('Network error');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleUpload} className="p-6 bg-white rounded shadow-md">
        <h1 className="text-2xl mb-4">Upload Resume</h1>
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="mb-4 w-full"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {loading ? 'Uploading...' : 'Upload'}
        </button>
        {message && <p className="mt-4 text-center">{message}</p>}
      </form>
    </div>
  );
}