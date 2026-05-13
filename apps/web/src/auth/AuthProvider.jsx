import { useMemo } from 'react';
import AuthContext from './AuthContext';

// Skeleton provider — Story 1.2 wires real signup/login state hydration.
function AuthProvider({ children }) {
  const value = useMemo(
    () => ({
      currentUser: null,
      token: null,
      login: () => {},
      logout: () => {
        localStorage.removeItem('bookshare.token');
      },
    }),
    [],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
