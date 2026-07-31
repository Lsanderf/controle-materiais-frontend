import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AUTH_STORAGE_KEY, readStoredAuth } from '../services/api';
import { login as requestLogin } from '../services/authService';
import { AuthContext } from './useAuth';

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readStoredAuth);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuth(null);
  }, []);

  useEffect(() => {
    window.addEventListener('auth:unauthorized', logout);
    return () => window.removeEventListener('auth:unauthorized', logout);
  }, [logout]);

  const login = useCallback(async ({ username, password }) => {
    const response = await requestLogin({ username, password });
    const nextAuth = {
      token: response.token,
      tokenType: response.tipo,
      role: response.role,
      username,
      expiresAt: Date.now() + response.expiraEm * 1000,
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
    setAuth(nextAuth);
    return nextAuth;
  }, []);

  const value = useMemo(
    () => ({
      auth,
      isAuthenticated: Boolean(auth?.token),
      role: auth?.role ?? null,
      login,
      logout,
      hasAnyRole: (...roles) => roles.includes(auth?.role),
    }),
    [auth, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
