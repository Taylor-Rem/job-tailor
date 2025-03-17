import '../styles/globals.css';
import NavBar from '../components/NavBar';
import { AuthProvider } from '../contexts/AuthContext';
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <NavBar />
      <Component {...pageProps} />
    </AuthProvider>
  );
}