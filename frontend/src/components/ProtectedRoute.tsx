import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    // Redirect to /login but carry the intended destination
    // so after login the user returns to where they were going
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
