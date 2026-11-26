import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { saveIntendedDestination } from '@/lib/share';

export function ProtectedRoute({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return fallback ?? (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    // Save the intended destination so we can redirect back after auth
    const intended = location.pathname + location.search + location.hash;
    if (intended !== '/' && intended !== '/auth') {
      saveIntendedDestination(intended);
    }
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
