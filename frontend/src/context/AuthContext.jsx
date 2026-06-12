/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/axiosConfig';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef(null);

  const logout = useCallback(async (sessionExpired = false) => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors on logout
    }
    setUser(null);
    if (sessionExpired) {
      toast.error('Session expired. Please log in again.', { duration: 4000 });
    }
  }, []);

  // Reset session timeout on user activity
  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (user) {
      timeoutRef.current = setTimeout(() => {
        logout(true);
      }, SESSION_TIMEOUT);
    }
  }, [user, logout]);

  // Track user activity
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, resetTimeout));
    return () => events.forEach((e) => window.removeEventListener(e, resetTimeout));
  }, [resetTimeout]);

  // Start session timer when user logs in
  useEffect(() => {
    if (user) {
      resetTimeout();
    } else {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [user, resetTimeout]);

  // Load user on mount (check if token exists)
  useEffect(() => {
    const initAuth = async () => {
      try {
        const response = await api.get('/auth/profile');
        setUser(response.data.data);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { user } = response.data.data;
    setUser(user);
    return user;
  };

  const register = async (data) => {
    const response = await api.post('/auth/register', data);
    const { user } = response.data.data;
    setUser(user);
    return user;
  };



  const updateUser = (updatedUser) => {
    setUser((prev) => ({ ...prev, ...updatedUser }));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
