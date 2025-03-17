import Link from 'next/link';

export default function Home() {
  return (
    <div className="full-height" style={{ paddingTop: '80px' }}>
      <div className="card">
        <h1 className="title">Welcome to Job Tailor!</h1>
        <p className="intro-text">
          The all-in-one app for finding jobs and creating custom resumes for each position. Here’s how it works:
        </p>
        <div className="steps">
          <p className="step">
            <span className="step-number">Step 1.</span> Create an account or log in to an existing account
          </p>
          <p className="step">
            <span className="step-number">Step 2.</span> Upload your most recent resume
          </p>
          <p className="step">
            <span className="step-number">Step 3.</span> Browse job listings and generate custom resumes for each one
          </p>
        </div>
        <Link href="/signup">
          <button className="button">Get Started Now!</button>
        </Link>
      </div>
    </div>
  );
}