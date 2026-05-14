import { createContext } from 'react';

// Real shape filled by AuthProvider. Default values let consumers safely
// destructure even when used outside the provider (which should never happen).
const AuthContext = createContext({
  currentUser: null,
  token: null,
  login: () => {},
  logout: () => {},
});

export default AuthContext;
