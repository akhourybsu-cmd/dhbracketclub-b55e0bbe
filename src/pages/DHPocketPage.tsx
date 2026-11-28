import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { DHGamesLogo } from '@/components/games/DHGamesLogo';
import { CartridgeFace, CartridgeShelf } from '@/components/pocket/CartridgeShelf';
import { PocketDevice, PocketMenuFrame } from '@/components/pocket/PocketHandheld';
import { POCKET_CARTRIDGES, type PocketCartridge, type PocketGameProps } from '@/components/pocket/cartridges';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useClubAssets } from '@/hooks/useClubAssets';
import { QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';
import '@/components/pocket/pocketLibrary.css';

const powerOnMs = 1550;
const insertionMs = 720;
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
type Direction = 'up' | 'down' | 'left' | 'right';
const idle = () => {};

function storedSelection(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function usePocketKeys(onDirection: (direction: Direction) => void, onA: () => void, onB: () => void) {
  useEffect(() => {
    const directions: Record<string, Direction> = { ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left', ArrowUp: 'up' };
    function keydown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      const nativeButton = event.target instanceof Element && event.target.closest('button, a, input, select, textarea');
      const direction = directions[event.key];
      if (direction) onDirection(direction);
      else if (/^[az]$/i.test(event.key) || (!nativeButton && (event.key === 'Enter' || event.key === ' '))) onA();
      else if (/^[bx]$/i.test(event.key) || event.key === 'Escape') onB();
      else return;
      event.preventDefault();
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [onA, onB, onDirection]);
}

function PocketStart({ onClose }: { onClose: () => void }) {
  usePocketKeys(idle, idle, onClose);
  return <PocketMenuFrame onDirection={idle} onConfirm={idle} onBack={onClose} controlsDisabled
    confirmLabel="Launch cartridge" backLabel="Close handheld">
    <div className="dp-display dp-boot" data-pocket-screen="boot" role="status">
      <DHGamesLogo className="dp-publisher" />
    </div>
  </PocketMenuFrame>;
}

function ShelfMenu({ cartridges, selected, pending, onSelect, onLaunch, onClose, onRefresh }: {
  cartridges: readonly PocketCartridge[];
  selected: PocketCartridge | undefined;
  pending: boolean;
  onSelect: (cartridge: PocketCartridge) => void;
  onLaunch: (cartridge: PocketCartridge) => void;
  onClose: () => void;
  onRefresh: () => void;
}) {
  function browse(direction: Direction) {
    if (cartridges.length < 2 || !selected) return;
    const step = direction === 'right' || direction === 'down' ? 1 : -1;
    const index = cartridges.indexOf(selected);
    onSelect(cartridges[(index + step + cartridges.length) % cartridges.length]);
  }
  function confirm() { if (selected) onLaunch(selected); }
  usePocketKeys(browse, confirm, onClose);
  return <PocketMenuFrame onDirection={browse} onConfirm={confirm} onBack={onClose}
    controlsDisabled={pending || !selected} confirmLabel="Launch cartridge" backLabel="Close handheld">
    {selected && !pending
      ? <CartridgeShelf cartridges={cartridges} selected={selected} onSelect={onSelect} onLaunch={onLaunch} />
      : <section className="dp-display dp-message" data-pocket-screen={pending ? 'checking' : 'empty'}>
          <h1>{pending ? 'Reading cartridges…' : 'No cartridges installed'}</h1>
          {!pending && <><p>Your club’s games appear here when enabled in Apps.</p>
            <button type="button" onClick={onRefresh}>Check again</button></>}
        </section>}
  </PocketMenuFrame>;
}

function InsertScreen({ cartridge, error, retryLabel, onBack, onRetry }: {
  cartridge: PocketCartridge; error: boolean; retryLabel: string; onBack: () => void; onRetry: () => void;
}) {
  usePocketKeys(idle, error ? onRetry : idle, onBack);
  return <PocketMenuFrame onDirection={idle} onConfirm={error ? onRetry : idle} onBack={onBack}
    controlsDisabled={!error} confirmLabel={error ? retryLabel : "Read cartridge"} backLabel="Return to cartridges">
    <section className="dp-display dp-insert" data-pocket-screen={error ? 'error' : 'loading'}>
      <div className="dp-insert-bay" aria-hidden="true">
        <div className="dp-insert-cart"><CartridgeFace cartridge={cartridge} /></div>
        <div className="dp-slot-lip" />
      </div>
      {error ? <div className="dp-message" role="alert"><h2>Couldn’t load {cartridge.title}.</h2>
        <button type="button" onClick={onRetry}>{retryLabel}</button>
        <button type="button" onClick={onBack}>Back to cartridges</button></div>
        : <h2 role="status">Loading {cartridge.title}<span aria-hidden="true">…</span></h2>}
    </section>
  </PocketMenuFrame>;
}

function LoadedCartridge({ cartridge, onExit }: { cartridge: PocketCartridge; onExit: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const [Game, setGame] = useState<ComponentType<PocketGameProps> | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let mounted = true;
    let timer: number;
    setError(false);
    const insert = new Promise<void>(resolve => { timer = window.setTimeout(resolve, reduceMotion() ? 120 : insertionMs); });
    Promise.all([withTimeout(cartridge.load(), QUERY_TIMEOUT_MS, 'Pocket cartridge'), insert]).then(([module]) => {
      if (mounted) setGame(() => module.default);
    }).catch(() => { if (mounted) setError(true); });
    return () => { mounted = false; window.clearTimeout(timer); };
  }, [cartridge, attempt]);
  if (Game) return <Game onExitPocketGame={onExit} />;
  return <InsertScreen cartridge={cartridge} onBack={onExit} error={error}
    retryLabel={attempt ? 'Reload game' : 'Try again'}
    onRetry={() => { if (attempt) window.location.reload(); else setAttempt(1); }} />;
}

function PocketSession({ cartridges, pending, onRefresh, storageKey }: {
  cartridges: readonly PocketCartridge[]; pending: boolean; onRefresh: () => void; storageKey: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const gameId = params.get('game');
  const [selectedId, setSelectedId] = useState(() => storedSelection(storageKey));
  const [booted, setBooted] = useState(!!gameId);
  const poweringOff = useRef(false);
  const requested = cartridges.find(cartridge => cartridge.id === gameId);
  const selected = cartridges.find(cartridge => cartridge.id === selectedId) || cartridges[0];

  const remember = useCallback((cartridge: PocketCartridge) => {
    setSelectedId(cartridge.id);
    try { localStorage.setItem(storageKey, cartridge.id); } catch { /* Device storage is optional. */ }
  }, [storageKey]);

  useEffect(() => {
    if (requested) remember(requested);
  }, [requested, remember]);
  useEffect(() => {
    if (booted) return;
    const timer = window.setTimeout(() => setBooted(true), reduceMotion() ? 600 : powerOnMs);
    return () => window.clearTimeout(timer);
  }, [booted]);
  useEffect(() => {
    if (gameId && !pending && !requested) navigate('/dh-pocket', { replace: true });
  }, [gameId, navigate, pending, requested]);

  useLayoutEffect(() => {
    // Remove the previous shelf entry as well when powering off from a game.
    if (poweringOff.current && !gameId) navigate('/dashboard', { replace: true, state: { focusPocketLauncher: true } });
  }, [gameId, navigate]);

  function launch(cartridge: PocketCartridge) {
    remember(cartridge);
    navigate(`/dh-pocket?game=${encodeURIComponent(cartridge.id)}`, { state: { pocketShelf: true } });
  }
  function exitGame() {
    if (location.state?.pocketShelf) navigate(-1);
    else navigate('/dh-pocket', { replace: true });
  }
  function closePocket() {
    if (gameId && location.state?.pocketShelf) {
      poweringOff.current = true;
      navigate(-1);
    } else navigate('/dashboard', { replace: true, state: { focusPocketLauncher: true } });
  }

  return <PocketDevice onClose={closePocket}>
    {!booted ? <PocketStart onClose={closePocket} />
      : requested && !pending ? <LoadedCartridge key={requested.id} cartridge={requested} onExit={exitGame} />
      : <ShelfMenu cartridges={cartridges} selected={selected} pending={pending}
          onSelect={remember} onLaunch={launch} onClose={closePocket} onRefresh={onRefresh} />}
  </PocketDevice>;
}

export default function DHPocketPage() {
  const { user, loading: authLoading } = useAuth();
  const { club, loading: clubLoading, isClubAdmin } = useClub();
  const { loading, isInstalled, isVisible, refresh } = useClubAssets();
  const cartridges = useMemo(() => POCKET_CARTRIDGES.filter(cartridge =>
    isInstalled(cartridge.assetSlug) && (isClubAdmin || isVisible(cartridge.assetSlug))),
  [isInstalled, isVisible, isClubAdmin]);
  const key = `dh-pocket:selection:${club?.id ?? ''}:${user?.id ?? ''}`;
  return <PocketSession key={key} storageKey={key} cartridges={cartridges}
    pending={authLoading || clubLoading || loading} onRefresh={() => void refresh()} />;
}
