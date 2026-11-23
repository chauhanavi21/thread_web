import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken, setToken } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Set while a deliberate sign-out is in flight, so route guards send people home instead of remembering the page.
  const signedOutOnPurpose = useRef(false);
  // Only "loading" if there is a stored token to validate.
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  useEffect(() => {
    const initialToken = getToken();
    if (!initialToken) return;
    let active = true;
    api
      .me()
      .then(({ user }) => { if (active && getToken() === initialToken) setUser(user); })
      .catch((err) => { if (active && getToken() === initialToken && err.status === 401) setToken(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const authenticate = useCallback((result) => {
    signedOutOnPurpose.current = false;
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const login = useCallback(async (email, password) => authenticate(await api.login({ email, password })), [authenticate]);
  const register = useCallback(async (fields) => authenticate(await api.register(fields)), [authenticate]);
  const logout = useCallback(() => {
    signedOutOnPurpose.current = true;
    setToken(null);
    setUser(null);
  }, []);

  const isAdmin = user?.role === 'admin';
  const value = useMemo(() => ({ user, isAdmin, loading, signedOutOnPurpose, login, register, logout }), [user, isAdmin, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
