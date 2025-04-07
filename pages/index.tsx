import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';

export default function Home() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobListing, setJobListing] = useState<string>('');
  const [uploadMessage, setUploadMessage] = useState<string>(''); // Added for feedback

  const handleUpload = async () => {
    if (!resumeFile) {
      setUploadMessage('Please select a resume file');
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
          setUploadMessage('Resume upload started—processing in background');
          if (data.temp_user_id) {
            setUser({ id: data.temp_user_id, username: 'Guest' });
          }
          // router.push('/'); // Uncomment later, keep here for now to see message
        } else {
          throw new Error(data.error || 'Upload failed');
        }
      } catch (error) {
        setUploadMessage(`Upload error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      {uploadMessage && <p>{uploadMessage}</p>}
      <textarea
        value={jobListing}
        onChange={(e) => setJobListing(e.target.value)}
        placeholder="Paste job listing here"
      />
      <button onClick={handleGenerateResume}>Generate Resume</button>
    </div>
  );
}