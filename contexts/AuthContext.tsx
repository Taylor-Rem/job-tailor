import { createContext, useContext, useState, ReactNode } from 'react';

type User = {
  id: number;
  username: string;
} | null;

type AuthContextType = {
  user: User;
  signup: (email: string, username: string, password: string) => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void; // Add setUser to the interface
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User>(null);

  const signup = async (email: string, username: string, password: string) => {
    const response = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    });
    const data = await response.json();
    if (response.ok) {
      setUser({
        id: data.user.id,
        username: data.user.username,
      });
    } else {
      throw new Error(data.message || 'Signup failed');
    }
  };

  const login = async (identifier: string, password: string) => {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const data = await response.json();
    if (response.ok) {
      setUser({
        id: data.user.id,
        username: data.user.username,
      });
    } else {
      throw new Error(data.message || 'Login failed');
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, signup, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};