import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  userId: number | null;
  login: (userId: number) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<number | null>(null);

  // Check localStorage on mount to persist login state
  useEffect(() => {
    const storedUserId = localStorage.getItem('user_id');
    if (storedUserId) {
      setUserId(Number(storedUserId));
    }
  }, []);

  const login = (userId: number) => {
    setUserId(userId);
    localStorage.setItem('user_id', userId.toString());
  };

  const logout = () => {
    setUserId(null);
    localStorage.removeItem('user_id');
  };

  return (
    <AuthContext.Provider value={{ userId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}