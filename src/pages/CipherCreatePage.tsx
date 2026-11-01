import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useShowdownLobby } from '@/hooks/useShowdown';
import { useCipherSetupDraft } from '@/hooks/useCipherSetup';
import type { CipherCode } from '@/lib/showdown/cipher/types';
import { CipherCodeMaker } from '@/components/showdown/cipher/CipherCodeMaker';
import { ShowdownDataState, ShowdownFrame } from '@/components/showdown/ShowdownChrome';

const lobbyUrl = '/showdown?game=cipher_duel';

export default function CipherCreatePage() {
  const { user, loading: authLoading } = useAuth();
  const { club, loading: clubLoading } = useClub();
  const [params] = useSearchParams();
  const recipientId = params.get('recipient_id') ?? '';
  const rematchOf = params.get('rematch_of') || undefined;
  if (authLoading || clubLoading) return <ShowdownFrame gameKey="cipher_duel" backTo={lobbyUrl}><ShowdownDataState title="Opening your code vault" /></ShowdownFrame>;
  if (!user || !club) return <ShowdownFrame gameKey="cipher_duel" backTo={lobbyUrl}><div className="sd-data-state"><Users aria-hidden="true" /><h1>Choose your club.</h1><p>Sign in to your club before setting a Cipher challenge.</p><Link className="sd-button sd-primary" to="/club">Open your club</Link></div></ShowdownFrame>;
  return <CipherCreateSession key={`${user.id}:${club.id}:${recipientId}:${rematchOf ?? ''}`} viewerId={user.id} recipientId={recipientId} rematchOf={rematchOf} />;
}

function CipherCreateSession({ viewerId, recipientId, rematchOf }: { viewerId: string; recipientId: string; rematchOf?: string }) {
  const navigate = useNavigate();
  const lobby = useShowdownLobby('cipher_duel');
  const setup = useCipherSetupDraft(recipientId, rematchOf);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true);
  const saving = useRef(false);
  useLayoutEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const member = lobby.data?.members.find(candidate => candidate.user_id === recipientId && candidate.user_id !== viewerId);
  const enabled = lobby.data?.games.some(game => game.game_key === 'cipher_duel' && game.enabled);
  const leave = () => navigate(lobbyUrl);

  async function lock(code: CipherCode) {
    if (!active.current || saving.current || !member || !enabled || !setup.ready) throw new Error('Choose an available club rival before locking your code.');
    saving.current = true; setBusy(true); setError(null);
    try {
      // Persist the exact code and request identity before the first network call.
      const intent = setup.prepare(code);
      const detail = await lobby.create({ recipientId, gameKey: 'cipher_duel', secretCode: intent.code, requestId: intent.requestId, rematchOf });
      if (!active.current) return;
      setup.complete();
      navigate(`/showdown/${detail.challenge.id}`, { replace: true });
    } catch (failure) {
      if (active.current) setError(failure instanceof Error ? failure.message : 'Your code could not be confirmed. Retry with the same code.');
      throw failure;
    } finally { saving.current = false; if (active.current) setBusy(false); }
  }

  if (!lobby.data) return <ShowdownFrame gameKey="cipher_duel" backTo={lobbyUrl}><ShowdownDataState title="Opening your code vault" error={lobby.error} retry={() => void lobby.refresh()} /></ShowdownFrame>;
  if (!member || !enabled) return <ShowdownFrame gameKey="cipher_duel" backTo={lobbyUrl}><div className="sd-data-state"><Users aria-hidden="true" /><h1>{!member ? 'Choose your rival.' : 'Cipher is unavailable.'}</h1><p>{!member ? 'This challenge needs another current member of your club.' : 'Your club cannot start a new Cipher Duel right now.'}</p><Link className="sd-button sd-primary" to={`${lobbyUrl}&challenge=new`}>Choose a challenge</Link></div></ShowdownFrame>;
  if (!setup.ready) return <ShowdownFrame gameKey="cipher_duel" backTo={lobbyUrl}><ShowdownDataState title="Opening your code vault" /></ShowdownFrame>;
  return <CipherCodeMaker opponent={{ displayName: member.display_name, avatarUrl: member.avatar_url }} onLock={lock} onLeave={leave} busy={busy || lobby.busy} error={error} initialCode={setup.draft} pendingCode={setup.pendingCode} onDraftChange={setup.onDraftChange} step="challenge" tutorialPreferenceKey={`dh:showdown:cipher:tutorial:v1:${viewerId}`} />;
}
