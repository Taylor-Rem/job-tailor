// pages/index.tsx
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push('/jobs');
  };

  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <h1>Welcome to Job Tailor</h1>
      <p>Find your dream job and tailor your resume with ease!</p>
      <button
        onClick={handleGetStarted}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
        }}
      >
        Get Started
      </button>
    </div>
  );
}