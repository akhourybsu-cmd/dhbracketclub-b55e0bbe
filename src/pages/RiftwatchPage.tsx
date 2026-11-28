import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, Crosshair, Disc3, Gamepad2, Play, RotateCcw, Settings2, Trophy } from 'lucide-react';
import { PocketActionKeys, PocketDpad, type PocketDirection } from '@/components/pocket/PocketHandheld';
import { PocketDeviceContext } from '@/components/pocket/deviceContext';
import type { PocketGameProps } from '@/components/pocket/cartridges';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { ArcadeLeaderboard, PersonalBestCard, RankChangeResult, useArcadeBoard, useRefreshArcadeBoards } from '@/components/arcade/ArcadeStandings';
import { ArcadeError, startArcadeRun, submitArcadeRun } from '@/lib/arcade/client';
import { RIFTWATCH } from '@/lib/arcade/riftwatchDefinition';
import { RiftField, type Flight } from '@/components/riftwatch/RiftField';
import { useArcadeControls, type MenuCommand } from '@/lib/riftwatch/controls';
import { readLocal, readPreferences, writeLocal, type RiftPreferences } from '@/lib/riftwatch/preferences';
import { RiftwatchAudio } from '@/lib/riftwatch/audio';
import { INPUT, createRun, summarize, type RunSummary } from '../../supabase/functions/_shared/arcade/riftwatch';
import type { ReplayEvent } from '../../supabase/functions/_shared/arcade/replay';
import '@/components/riftwatch/riftwatch.css';

type Screen = 'title'|'preparing'|'ready'|'playing'|'paused'|'result'|'leaderboard'|'help'|'settings';
type Pending = { runId: string; expiresAt: string; inputs: ReplayEvent[]; summary: RunSummary };
type Receipt = Awaited<ReturnType<typeof submitArcadeRun>>;
type Outcome = { summary: RunSummary; status: 'practice'|'pending'|'verifying'|'verified'|'rejected'; receipt?: Receipt; message?: string; practiceBest?: boolean };
const scoreText = (score: number) => score.toLocaleString();
const fieldScreens: Screen[] = ['ready','playing','paused'];

export default function RiftwatchPage({ onExitPocketGame, practiceOnly = false }: PocketGameProps & { practiceOnly?: boolean }) {
  const { club } = useClub();
  const { user } = useAuth();
  const clubId = club?.id;
  const userId = user?.id;
  const scope = useMemo(() => !practiceOnly && userId && clubId ? {
    clubId, gameKey: RIFTWATCH.key, rulesetVersion: RIFTWATCH.rulesetVersion,
  } : null, [clubId, userId, practiceOnly]);
  const key = practiceOnly ? 'practice' : `${encodeURIComponent(user?.id ?? 'guest')}:${encodeURIComponent(club?.id ?? 'none')}`;
  return <FlightDeck key={key + ':' + practiceOnly} scope={scope} storeKey={key}
    clubName={club?.name} onEject={onExitPocketGame} practiceOnly={practiceOnly} />;
}

type Scope = Parameters<typeof startArcadeRun>[0];
function FlightDeck({ scope, storeKey, clubName, onEject, practiceOnly }: {
  scope: Scope | null; storeKey: string; clubName?: string; onEject: () => void; practiceOnly: boolean;
}) {
  const device = useContext(PocketDeviceContext);
  const [screen, setScreen] = useState<Screen>('title');
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [settings, setSettings] = useState(readPreferences);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [cue, setCue] = useState(0);
  const [notice, setNotice] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [returnScreen, setReturnScreen] = useState<'title'|'result'>('title');
  const [held, setHeld] = useState<PocketDirection | null>(null);
  const viewport = useRef<HTMLElement>(null);
  const sound = useRef<RiftwatchAudio | null>(null);
  const lastMenuControl = useRef<HTMLElement | null>(null);
  const key = 'dh:arcade:pending:' + RIFTWATCH.key + ':' + RIFTWATCH.rulesetVersion + ':' + storeKey;
  const bestKey = 'dh:arcade:practice:' + RIFTWATCH.key + ':' + RIFTWATCH.rulesetVersion;
  const [practiceBest, setPracticeBest] = useState(() => Number(readLocal<number>(bestKey)) || 0);
  const [pending, setPending] = useState(() => {
    const saved = scope ? readLocal<Pending>(key) : null;
    return saved && typeof saved.runId === 'string' && typeof saved.expiresAt === 'string' &&
      Array.isArray(saved.inputs) && saved.summary &&
      [saved.summary.score, saved.summary.wave, saved.summary.kills, saved.summary.simulationTicks]
        .every(value => Number.isSafeInteger(value) && value >= 0) ? saved : null;
  });
  const request = useRef(0);
  const working = useRef(false);
  const startId = useRef<ReturnType<Crypto['randomUUID']> | null>(null);
  const board = useArcadeBoard(online ? scope : null);
  const refreshBoards = useRefreshArcadeBoards();
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const controls = useArcadeControls(screen === 'playing', command, inactive);

  useEffect(() => {
    const audio = new RiftwatchAudio();
    const requests = request;
    sound.current = audio;
    const update = () => setOnline(navigator.onLine !== false);
    const restoreMenuAudio = () => {
      if (document.hidden || fieldScreens.includes(screenRef.current)) return;
      if (screenRef.current === 'result') audio.results();
      else if (screenRef.current !== 'preparing') audio.title();
    };
    document.addEventListener('visibilitychange', restoreMenuAudio);
    window.addEventListener('focus', restoreMenuAudio);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      requests.current++;
      document.removeEventListener('visibilitychange', restoreMenuAudio);
      window.removeEventListener('focus', restoreMenuAudio);
      audio.dispose(); sound.current = null;
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  useEffect(() => {
    writeLocal('dh:riftwatch:settings:v1', settings);
    sound.current?.configure(settings);
  }, [settings]);
  useEffect(() => {
    const audio = sound.current;
    if (!audio || document.hidden) return;
    if (screen === 'playing') audio.play();
    else if (screen === 'title' || screen === 'help' || screen === 'settings' || screen === 'leaderboard') audio.title();
    else if (screen === 'result') audio.results();
    else audio.pause();
    if (screen !== 'playing') {
      const node = viewport.current?.querySelector<HTMLElement>('button:not(:disabled), input');
      node?.focus({ preventScroll: true });
    }
  }, [screen]);
  useEffect(() => {
    if (screen !== 'ready') return;
    const timer = window.setTimeout(() => {
      if (document.hidden) { setScreen('paused'); return; }
      if (cue >= 2) { controls.clear(); setScreen('playing'); }
      else setCue(cue + 1);
    }, 325);
    return () => clearTimeout(timer);
  }, [screen, cue, controls]);

  function inactive() {
    controls.clear();
    setHeld(null);
    sound.current?.pause();
    if (fieldScreens.includes(screenRef.current)) setScreen('paused');
  }
  function gesture() {
    sound.current?.unlock();
    if (screenRef.current === 'title') sound.current?.title();
  }
  function change<K extends keyof RiftPreferences>(field: K, value: RiftPreferences[K]) {
    gesture();
    setSettings(previous => ({ ...previous, [field]: value }));
  }
  function title() {
    request.current++;
    working.current = false;
    controls.clear();
    setHeld(null); setNotice(''); setFlight(null); setScreen('title');
  }
  function beginFlight(seed: string, mode: Flight['mode'], ticket?: Flight['ticket']) {
    controls.clear(); setHeld(null); setNotice(''); setOutcome(null);
    setCue(0);
    setFlight({ state:createRun(seed), inputs:[], recordable:true, mode, ticket });
    setScreen(document.hidden ? 'paused' : 'ready');
  }
  async function start(mode: Flight['mode']) {
    if (working.current) return;
    gesture();
    if (mode === 'practice') {
      const seed = Array.from(crypto.getRandomValues(new Uint32Array(2)), n => n.toString(16)).join('-');
      beginFlight(seed, mode);
      return;
    }
    if (!scope || !online) { setNotice('Connect to your club to start a ranked run. Practice is ready.'); return; }
    if (pending) { showPending(); return; }
    working.current = true;
    const generation = ++request.current;
    setNotice(''); setScreen('preparing');
    try {
      startId.current ??= crypto.randomUUID();
      const session = await startArcadeRun(scope, startId.current);
      if (generation === request.current) {
        startId.current = null;
        beginFlight(session.seed, mode, session);
      }
    } catch (error) {
      if (generation === request.current) {
        if (error instanceof ArcadeError && !error.retryable) startId.current = null;
        setNotice(error instanceof Error ? error.message : 'Couldn’t start a ranked run. Try again or play Practice.');
        setScreen('title');
      }
    } finally { if (generation === request.current) working.current = false; }
  }
  function keepPending(value: Pending | null) {
    setPending(value); writeLocal(key, value);
  }
  async function verify(packet: Pending) {
    if (!scope || working.current) return;
    if (!online || navigator.onLine === false) {
      setOutcome({summary:packet.summary,status:'pending',message:'Reconnect to verify this run.'}); return;
    }
    working.current = true;
    const generation = ++request.current;
    setOutcome({summary:packet.summary,status:'verifying'});
    try {
      const receipt = await submitArcadeRun(scope, packet.runId, packet.inputs, packet.summary);
      if (generation !== request.current) return;
      keepPending(null);
      setOutcome({ summary: { score:receipt.score, wave:receipt.wave, kills:receipt.kills, simulationTicks:receipt.simulationTicks }, status:'verified', receipt });
      refreshBoards(scope, receipt.leaderboard);
      if (receipt.rankChange > 0) sound.current?.cue('rank');
      else if (receipt.isPersonalBest) sound.current?.cue('best');
    } catch (error) {
      if (generation !== request.current) return;
      const retryable = !(error instanceof ArcadeError) || error.retryable;
      const message = error instanceof Error ? error.message : 'Couldn’t reach the score server.';
      if (!retryable) keepPending(null);
      setOutcome({summary:packet.summary,status:retryable ? 'pending' : 'rejected',message});
    } finally { if (generation === request.current) working.current = false; }
  }
  function showPending() {
    if (!pending) return;
    setOutcome({ summary:pending.summary,status:'pending', message:'This run is waiting for verification.' });
    setFlight(null); setScreen('result');
  }
  function finish(run: Flight) {
    controls.clear(); setHeld(null);
    const summary = summarize(run.state);
    setScreen('result');
    if (run.mode === 'practice') {
      const best = summary.score > practiceBest;
      if (best) { setPracticeBest(summary.score); writeLocal(bestKey,summary.score); }
      setOutcome({summary,status:'practice',practiceBest:best});
      return;
    }
    if (!run.recordable) {
      setOutcome({summary,status:'rejected',message:'Input recording reached its limit. This score is unranked.'}); return;
    }
    const packet = {runId:run.ticket.runId, expiresAt:run.ticket.expiresAt, inputs:run.inputs, summary};
    keepPending(packet);
    void verify(packet);
  }
  function pause() {
    if (screenRef.current === 'playing' || screenRef.current === 'ready') {
      controls.clear(); setHeld(null); setScreen('paused');
    } else if (screenRef.current === 'paused' && !document.hidden) {
      controls.clear(); gesture(); setCue(0); setScreen('ready');
    }
  }
  function leave() { (device?.closeDevice || onEject)(); }
  function command(action: MenuCommand) {
    const current = screenRef.current;
    if (action === 'menu') { if (fieldScreens.includes(current)) pause(); return; }
    if (current === 'playing' || current === 'ready') return;
    if (action === 'cancel') {
      if (current === 'title') onEject();
      else if (current === 'leaderboard') setScreen(returnScreen);
      else if (current === 'paused') pause();
      else title();
      return;
    }
    const buttons = Array.from(viewport.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? []);
    let active = buttons.indexOf(document.activeElement as HTMLElement);
    if (active < 0) active = buttons.indexOf(lastMenuControl.current);
    if (action === 'confirm') { gesture(); (buttons[Math.max(0,active)])?.click(); return; }
    if (!buttons.length) return;
    const slider = buttons[active];
    if (slider instanceof HTMLInputElement && slider.type === 'range' && (action === 'left' || action === 'right')) {
      if (action === 'left') slider.stepDown(); else slider.stepUp();
      change(slider.dataset.volume as 'music'|'sfx', Number(slider.value)); return;
    }
    const offset = action === 'right' || action === 'down' ? 1 : -1;
    buttons[(Math.max(0,active) + offset + buttons.length) % buttons.length]?.focus();
  }
  function goBoard(from: 'title' | 'result') { setReturnScreen(from); setScreen('leaderboard'); }
  function tool(label: string, Icon: typeof Play, onClick: () => void) {
    return <button type="button" className="rw-tool" onClick={onClick} title={label} aria-label={label}><Icon size={18} aria-hidden="true" /></button>;
  }
  const memberBest = board.data?.personalBest?.score || 0;
  const playing = screen === 'playing';
  const field = fieldScreens.includes(screen) && flight !== null;
  const heading = (name: string, back = title) => <header className="rw-panel-head">
    {tool('Back', ArrowLeft, back)}<h1>{name}</h1></header>;
  return <div className="mesomon pocket-menu-frame rw-device" data-rw-screen={screen}
    data-rw-mode={flight?.mode || (screen === 'result' && outcome?.status !== 'practice' ? 'ranked' : undefined)}
    data-rw-verification={outcome?.status} data-contrast={settings.highContrast || undefined}
    data-motion={settings.reducedMotion ? 'reduced' : 'full'} onPointerDownCapture={gesture}>
    <main ref={viewport} className="pocket-lcd rw-lcd" onFocusCapture={event => { lastMenuControl.current = event.target; }}>
      {field && <RiftField flight={flight} playing={playing} best={flight.mode === 'ranked' ? memberBest : practiceBest}
        settings={settings} controls={controls} sound={sound} onFinish={finish} />}
      {screen === 'title' && <section className="rw-cover">
        <div className="rw-mast"><h1 className="sr-only">{RIFTWATCH.name}</h1>
          <img src="/games/riftwatch/title.png" alt="" draggable="false" /></div>
        <div className="rw-title-panel">
          <div className="rw-credit"><span>{practiceOnly ? 'Practice arcade' : clubName}</span>
            {scope && online ? <PersonalBestCard entry={board.data?.personalBest} /> : <span>Local best <b>{scoreText(practiceBest)}</b></span>}</div>
          {notice && <p className="rw-notice" role="alert">{notice}</p>}
          <div className="rw-options">
            {pending && <button className="rw-primary" onClick={showPending}><RotateCcw /> Verify last run</button>}
            {!practiceOnly && !pending && <button className="rw-primary" onClick={() => void start('ranked')}><Crosshair />Ranked Run</button>}
            <button className={practiceOnly ? 'rw-primary' : ''} onClick={() => void start('practice')}><Gamepad2 />Practice</button>
            {!practiceOnly && <button onClick={() => goBoard('title')}><Trophy />Leaderboard</button>}
          </div>
          <div className="rw-tools">
            {tool('How to play',BookOpen,()=>setScreen('help'))}
            {tool('Settings',Settings2,()=>setScreen('settings'))}
            {!practiceOnly && tool('Eject cartridge',Disc3,onEject)}
            <button className="rw-tool rw-return" onClick={leave}>Return to DH <ArrowUpRight size={16} aria-hidden="true" /></button>
          </div>
        </div>
      </section>}
      {screen === 'preparing' && <section className="rw-overlay"><Crosshair size={32} /><h1 role="status">Preparing ranked run…</h1><button onClick={title}>Cancel</button></section>}
      {screen === 'ready' && <div className="rw-cue" role="status" key={cue}><div><small>{flight?.mode === 'ranked' ? 'Ranked run' : 'Practice run'}</small>{['READY','HOLD','WATCH'][cue]}</div></div>}
      {screen === 'paused' && <section className="rw-overlay"><h1>Paused</h1><p>{flight?.mode === 'ranked' ? 'Ranked run' : 'Practice run'} · Wave {flight?.state.wave}</p>
        <button className="rw-primary" onClick={pause}><Play />Resume</button>
        <button onClick={title}>Leave run</button></section>}
      {screen === 'help' && <section className="rw-panel">{heading('How to play')}
        <dl className="rw-brief"><dt>Move</dt><dd>D-pad, ← → or A / D. Stop the formation before it reaches your line.</dd>
          <dt>Fire</dt><dd>Hold A, Z, Space or Enter. Shoot through gaps in the wards.</dd>
          <dt>Pulse</dt><dd>Press B, X or Shift when charged to clear nearby fire and interrupt dives.</dd>
          <dt>Score</dt><dd>Chain kills within 2.25 seconds for up to 2× points. Preserve wards and clear waves without a hit for bonuses.</dd>
          <dt>Ranked</dt><dd>Verified runs compete in your club. Practice records a best on this device. Menu or Esc pauses.</dd></dl>
      </section>}
      {screen === 'settings' && <section className="rw-panel">{heading('Settings')}
        <div className="rw-settings">
          <button aria-pressed={settings.muted} onClick={()=>change('muted',!settings.muted)}>Mute audio <b>{settings.muted ? 'On' : 'Off'}</b></button>
          {(['music','sfx'] as const).map(key => <label key={key}>{key === 'music' ? 'Music' : 'Effects'}
            <input aria-label={key === 'music' ? 'Music volume' : 'Effects volume'} data-volume={key} type="range" min="0" max="1" step=".05"
            value={settings[key]} onChange={e=>change(key,Number(e.target.value))} /></label>)}
          <button aria-pressed={settings.highContrast} onClick={()=>change('highContrast',!settings.highContrast)}>High contrast <b>{settings.highContrast ? 'On' : 'Off'}</b></button>
          <button aria-pressed={settings.reducedMotion} onClick={()=>change('reducedMotion',!settings.reducedMotion)}>Reduced motion <b>{settings.reducedMotion ? 'On' : 'Off'}</b></button>
        </div>
      </section>}
      {screen === 'leaderboard' && <section className="rw-panel">{heading('Leaderboard',()=>setScreen(returnScreen))}
        {scope && online ? <ArcadeLeaderboard scope={scope} /> : <p className="rw-notice">Connect to your club to see verified scores.</p>}</section>}
      {screen === 'result' && outcome && <section className="rw-panel rw-result">
        {heading('Run complete')}<div className="rw-score"><span>{outcome.status === 'practice' ? 'Practice score' : 'Run score'}</span>
          <strong>{scoreText(outcome.summary.score)}</strong><p>Wave {outcome.summary.wave} · {outcome.summary.kills} destroyed</p></div>
        <div className="rw-receipt" role="status">
          {outcome.status === 'practice' && <p>{outcome.practiceBest ? 'New device best' : 'Practice'} · Best {scoreText(practiceBest)}</p>}
          {outcome.status === 'verifying' && <p>Verifying score…</p>}
          {outcome.status === 'verified' && <><b>Verified score</b><RankChangeResult result={outcome.receipt} /></>}
          {(outcome.status === 'pending' || outcome.status === 'rejected') && <p><b>{outcome.status === 'pending' ? 'Verification pending' : 'Score unranked'}</b><br/>{outcome.message}</p>}
        </div>
        <div className="rw-options">
          {outcome.status === 'pending' && pending && <button className="rw-primary" onClick={()=>void verify(pending)}>Retry verification</button>}
          {scope && !pending && outcome.status !== 'verifying' && <button className="rw-primary" onClick={()=>void start('ranked')}>Retry ranked</button>}
          <button disabled={outcome.status === 'verifying'} onClick={()=>void start('practice')}>Practice</button>
          {scope && <button onClick={()=>goBoard('result')}>Leaderboard</button>}
        </div>
        <div className="rw-end-nav"><button onClick={title}>Return to title</button><button onClick={leave}>Return to DH</button></div>
      </section>}
    </main>
    <div className="mm-control-deck rw-deck"
      onPointerDownCapture={event => {
        const button = (event.target as Element).closest<HTMLButtonElement>('.mm-a,.mm-b');
        if (!button) return;
        delete button.dataset.flightPress;
        if (!playing || (event.pointerType === 'mouse' && event.button !== 0)) return;
        button.dataset.flightPress = 'true';
        button.setPointerCapture(event.pointerId);
        controls.touch(button.classList.contains('mm-a') ? INPUT.fire : INPUT.pulse,true);
        button.dataset.down = 'true';
      }}
      onClickCapture={event => {
        // A finger still holding Fire when the run ends must not dismiss the result.
        const button = (event.target as Element).closest<HTMLButtonElement>('[data-flight-press]');
        if (button && event.detail > 0) {
          delete button.dataset.flightPress;
          event.stopPropagation();
        }
      }}
      onLostPointerCapture={event => {
        const button = (event.target as Element).closest<HTMLButtonElement>('.mm-a,.mm-b');
        if (!button) return;
        controls.touch(button.classList.contains('mm-a') ? INPUT.fire : INPUT.pulse,false);
        delete button.dataset.down;
      }}>
      <PocketDpad browseLabel="Navigate Riftwatch menu" onDirection={direction => playing ? controls.tap(direction === 'left' ? INPUT.left : direction === 'right' ? INPUT.right : 0) : command(direction)}
        hold={playing ? {direction:held,start:dir=>{controls.move(dir);setHeld(dir);},stop:()=>{controls.move(null);setHeld(null);}} : undefined} />
      <div className="mm-quick-actions"><button className="mm-start-key" type="button" aria-label={field ? 'Pause menu' : 'Game menu'}
        onClick={()=>field ? pause() : screen === 'title' ? setScreen('settings') : title()}>Menu</button></div>
      <PocketActionKeys confirmLabel={playing ? 'Fire' : 'Confirm'} backLabel={playing ? 'Eden Pulse' : 'Back'}
        confirmCaption={playing ? 'FIRE' : 'SELECT'} backCaption={playing ? 'PULSE' : 'BACK'}
        onConfirm={event => { if (!playing) command('confirm'); else if (event.detail === 0) controls.tap(INPUT.fire); }}
        onBack={event=>{ if (!playing) command('cancel'); else if (event.detail === 0) controls.tap(INPUT.pulse); }} />
    </div>
  </div>;
}
