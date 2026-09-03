import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    void withTimeout(supabase.auth.getSession(), QUERY_TIMEOUT_MS, 'auth session')
      .then(({ data: { session } }) => {
        if (!alive) return;
        setSession(session);
        setUser(session?.user ?? null);
      })
      .catch((err) => {
        console.error('[AuthContext] session load failed', err);
        if (!alive) return;
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // Defense in depth: purge user-scoped client state before invalidating
    // sessions globally. Device-only prefs (sound/music/tutorial seen flags)
    // are intentionally preserved — they are not user-identifying.
    try {
      if (typeof window !== 'undefined') {
        const userScopedPrefixes = [
          'nexus_run_state_v1:',
          'dh_onboarding_v1:',
          'dh_home_quickbar_v1:',
          'dh_chat_draft_v1:',
        ];
        const singleKeys = ['last_chat_channel_id'];
        const toRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (!k) continue;
          if (singleKeys.includes(k)) { toRemove.push(k); continue; }
          if (userScopedPrefixes.some((p) => k.startsWith(p))) toRemove.push(k);
        }
        toRemove.forEach((k) => { try { window.localStorage.removeItem(k); } catch { /* ignore */ } });
        try { window.sessionStorage.clear(); } catch { /* ignore */ }
      }
    } catch { /* never block sign-out on cleanup */ }

    // scope: 'global' revokes refresh tokens on every device for this user.
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch {
      // Fall back to local sign-out so the UI does not get stuck if the
      // network call fails (e.g. token already revoked server-side).
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
