import { Navigate, useLocation } from 'react-router-dom';
import useAuth from './useAuth';

// Route wrapper — redirects to /login when no token is present. Story 1.3 fills in real auth state.
function RequireAuth({ children }) {
  const { token } = useAuth();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

export default RequireAuth;
