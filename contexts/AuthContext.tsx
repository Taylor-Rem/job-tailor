import { createContext, useContext, useState, ReactNode } from 'react';

type User = {
  id: number;
  username: string;
  email?: string;
  plan?: number;
} | null;

type AuthContextType = {
  user: User;
  signup: (email: string, username: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  login: (identifier: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  logout: () => void;
  setUser: (user: User) => void;
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
      const userData: User = {
        id: data.user.id,
        username: data.user.username,
        email: data.user.email,
        plan: data.user.plan,
      };
      setUser(userData);
      return { success: true, user: userData };
    } else {
      return { success: false, error: data.error || 'Signup failed' };
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
      const userData: User = {
        id: data.user.id,
        username: data.user.username,
        email: data.user.email,
        plan: data.user.plan,
      };
      setUser(userData);
      return { success: true, user: userData };
    } else {
      return { success: false, error: data.error || 'Login failed' };
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