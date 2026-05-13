import { useContext } from 'react';
import AuthContext from './AuthContext';

// Hook for components that need auth state.
function useAuth() {
  return useContext(AuthContext);
}

export default useAuth;
