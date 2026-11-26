import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';

/**
 * Routes signed-in users based on their onboarding state.
 * Approved users (club members or platform owners) get full app access.
 * Everyone else is funneled to /club/request (the unified onboarding shell).
 */
export function ClubGate({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { state, loading } = useOnboardingStatus();
  const location = useLocation();

  if (authLoading || loading) {
    return fallback ?? (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="loading-spinner-ring" />
      </div>
    );
  }

  if (!user) return <>{children}</>; // ProtectedRoute handles non-auth case

  // Routes always accessible (sign out, profile, admin review, onboarding shell)
  const allowAlways = ['/club/request', '/club/settings', '/admin/clubs', '/profile'];
  const onAllowed = allowAlways.some((p) => location.pathname.startsWith(p));

  if (state !== 'approved' && !onAllowed) {
    return <Navigate to="/club/request" replace />;
  }

  return <>{children}</>;
}
