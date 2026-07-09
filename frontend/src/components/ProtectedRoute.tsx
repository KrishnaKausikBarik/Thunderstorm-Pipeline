import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    // Redirect to /login but carry the intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Block users who haven't verified their email (except Google users which are auto-verified)
  if (!currentUser.emailVerified) {
    return <Navigate to="/login" state={{ mode: 'verify_email', from: location }} replace />;
  }

  return <>{children}</>;
}
