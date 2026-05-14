import { useCallback, useEffect, useMemo, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import AuthContext from './AuthContext';

const TOKEN_KEY = 'bookshare.token';
const USER_KEY = 'bookshare.user';

function readPersistedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function decodeUserFromToken(token) {
  try {
    const { sub, exp } = jwtDecode(token);
    if (!sub) return null;
    if (exp && Date.now() / 1000 >= exp) return null;
    return { id: sub };
  } catch {
    return null;
  }
}

function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [currentUser, setCurrentUser] = useState(() => {
    const stored = readPersistedUser();
    if (stored) return stored;
    const t = localStorage.getItem(TOKEN_KEY);
    return t ? decodeUserFromToken(t) : null;
  });

  // Keep storage in sync with state.
  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }, [token]);

  useEffect(() => {
    if (currentUser) localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
    else localStorage.removeItem(USER_KEY);
  }, [currentUser]);

  const login = useCallback((newToken, user) => {
    setToken(newToken);
    setCurrentUser(user || decodeUserFromToken(newToken));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setCurrentUser(null);
  }, []);

  const value = useMemo(
    () => ({ token, currentUser, login, logout }),
    [token, currentUser, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
