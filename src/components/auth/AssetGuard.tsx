import { Navigate } from "react-router-dom";
import { useClubAssets } from "@/hooks/useClubAssets";
import { useClub } from "@/contexts/ClubContext";

/**
 * Frontend defense-in-depth guard for asset-gated pages.
 *
 * Blocks navigation to a page when the parent asset is not installed/enabled
 * for the current club. App admins always bypass so they can audit/manage
 * uninstalled assets. RLS still enforces data access at the DB layer — this
 * is purely a UX/route-leak prevention layer.
 */
export function AssetGuard({
  slug,
  children,
  fallback,
}: {
  slug: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { isInstalled, loading } = useClubAssets();
  const { isAppAdmin } = useClub();

  // Wait for asset list to load before deciding — avoids flicker-redirects
  if (loading) return fallback ?? null;
  if (isAppAdmin) return <>{children}</>;
  if (!isInstalled(slug)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
