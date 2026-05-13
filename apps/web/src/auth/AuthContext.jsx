import { createContext } from 'react';

// Empty for Story 1.1 — real shape (`{ currentUser, token, login, logout }`) is wired in Story 1.2 / 1.3.
const AuthContext = createContext({
  currentUser: null,
  token: null,
  login: () => {},
  logout: () => {},
});

export default AuthContext;
