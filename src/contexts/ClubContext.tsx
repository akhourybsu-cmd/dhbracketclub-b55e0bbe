import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { HYDRATE_TIMEOUT_MS, QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';

export type Club = {
  id: string;
  name: string;
  slug: string;
  accent_color: string; // HSL parts e.g. "152 72% 46%"
  logo_url: string | null;
  owner_admin_id: string | null;
  status: string;
  password_visible: boolean;
};

export type ClubMembership = {
  club_id: string;
  role: 'admin' | 'member';
};

interface ClubContextType {
  club: Club | null;
  membership: ClubMembership | null;
  loading: boolean;
  isClubAdmin: boolean;
  isPlatformOwner: boolean;
  isAppAdmin: boolean;
  refresh: () => Promise<void>;
}

const ClubContext = createContext<ClubContextType>({
  club: null,
  membership: null,
  loading: true,
  isClubAdmin: false,
  isPlatformOwner: false,
  isAppAdmin: false,
  refresh: async () => {},
});

export const useClub = () => useContext(ClubContext);

export function ClubProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [membership, setMembership] = useState<ClubMembership | null>(null);
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);
  const [isAppAdmin, setIsAppAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setClub(null);
      setMembership(null);
      setIsPlatformOwner(false);
      setIsAppAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // NOTE: club passwords are never persisted in browser storage. If email
      // confirmation interrupts signup, the user re-enters the password on the
      // onboarding screen (/club/request).


      const [membershipResult, ownerResult, adminResult] = await withTimeout(
        Promise.allSettled([
          withTimeout(
            supabase
              .from('club_members')
              .select('club_id, role, clubs:club_id(id, name, slug, accent_color, logo_url, owner_admin_id, status, password_visible)')
              .eq('user_id', user.id)
              .maybeSingle(),
            QUERY_TIMEOUT_MS,
            'club membership',
          ),
          withTimeout(
            supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', user.id)
              .eq('role', 'owner')
              .maybeSingle(),
            QUERY_TIMEOUT_MS,
            'platform owner role',
          ),
          withTimeout(
            supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', user.id)
              .eq('role', 'admin')
              .maybeSingle(),
            QUERY_TIMEOUT_MS,
            'app admin role',
          ),
        ]),
        HYDRATE_TIMEOUT_MS,
        'club hydrate',
      );

      const membershipResponse = membershipResult.status === 'fulfilled' ? membershipResult.value : null;
      const ownerResponse = ownerResult.status === 'fulfilled' ? ownerResult.value : null;
      const adminResponse = adminResult.status === 'fulfilled' ? adminResult.value : null;

      if (membershipResult.status === 'rejected') console.error('[ClubContext] membership load failed', membershipResult.reason);
      if (ownerResult.status === 'rejected') console.error('[ClubContext] owner role load failed', ownerResult.reason);
      if (adminResult.status === 'rejected') console.error('[ClubContext] admin role load failed', adminResult.reason);

      const m = membershipResponse?.data;
      setIsPlatformOwner(!!ownerResponse?.data);
      setIsAppAdmin(!!adminResponse?.data);
      if (m?.clubs) {
        setClub(m.clubs as Club);
        setMembership({ club_id: m.club_id, role: (m.role as ClubMembership['role']) });
      } else {
        setClub(null);
        setMembership(null);
      }
    } catch (err) {
      console.error('[ClubContext] load failed', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  // Inject the club's accent color as a CSS variable on the root element
  useEffect(() => {
    const root = document.documentElement;
    if (club?.accent_color) {
      root.style.setProperty('--club-accent', club.accent_color);
    } else {
      root.style.setProperty('--club-accent', '152 72% 46%'); // emerald fallback
    }
  }, [club]);

  return (
    <ClubContext.Provider
      value={{
        club,
        membership,
        loading,
        isClubAdmin: membership?.role === 'admin' || isAppAdmin,
        isPlatformOwner,
        isAppAdmin,
        refresh: load,
      }}
    >
      {children}
    </ClubContext.Provider>
  );
}
