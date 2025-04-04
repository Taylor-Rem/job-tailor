// pages/index.tsx
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';

export default function Home() {
  const { user, setUser } = useAuth(); // setUser is now available
  const router = useRouter();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobListing, setJobListing] = useState<string>('');

  const handleUpload = async () => {
    if (!resumeFile) {
      console.log('Please select a resume file');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      const body = user
        ? { user_id: user.id, file_name: resumeFile.name, resume: base64String }
        : { file_name: resumeFile.name, resume: base64String };

      try {
        const response = await fetch('/api/upload-resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await response.json();
        if (response.ok) {
          console.log('Upload successful:', data);
          if (data.temp_user_id) {
            setUser({ id: data.temp_user_id, username: 'Guest' });
          }
          router.push('/'); // Or to an edit page later
        } else {
          throw new Error(data.error || 'Upload failed');
        }
      } catch (error) {
        console.error('Upload error:', error);
      }
    };
    reader.readAsDataURL(resumeFile);
  };

  const handleGenerateResume = () => {
    console.log('Job Listing:', jobListing);
  };

  return (
    <div className="container">
      <h1>Custom Resume Generator</h1>
      <p>Logged in as: {user ? `${user.username} (ID: ${user.id})` : 'Not logged in'}</p>
      <input
        type="file"
        accept=".pdf"
        onChange={(e) => {
          if (e.target.files) {
            setResumeFile(e.target.files[0]);
          }
        }}
      />
      <button onClick={handleUpload}>Upload</button>
      <textarea
        value={jobListing}
        onChange={(e) => setJobListing(e.target.value)}
        placeholder="Paste job listing here"
      />
      <button onClick={handleGenerateResume}>Generate Resume</button>
    </div>
  );
}