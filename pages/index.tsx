import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="p-6 bg-white rounded shadow-md text-center">
        <h1 className="text-2xl mb-4">Job Tailor</h1>
        <Link href="/signup" className="text-blue-500 hover:underline mr-2">Sign Up</Link>
        <Link href="/login" className="text-blue-500 hover:underline mr-2">Log In</Link>
        <Link href="/upload" className="text-blue-500 hover:underline">Upload Resume</Link>
      </div>
    </div>
  );
}