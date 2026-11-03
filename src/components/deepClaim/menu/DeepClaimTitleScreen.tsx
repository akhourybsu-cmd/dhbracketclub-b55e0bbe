import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowDownToLine, ArrowRight, BookOpen, DoorOpen, PackageCheck, Pickaxe, Play, RefreshCw, Settings, ShieldCheck, Users, WifiOff } from 'lucide-react';
import { DeepClaimMark } from '../DeepClaimMark';
import { ClaimButton, ClaimDialog } from '../DeepClaimPrimitives';
import { DeepClaimMenuBackdrop } from './DeepClaimMenuBackdrop';
import './menu.css';

export interface DeepClaimMenuSummary {
  companyName: string;
  supportedDepth: number;
  employeeCount: number;
  activeExpeditions: number;
  readyCollections: number;
  lastSyncedAt?: string | null;
}
export interface DeepClaimTitleScreenProps {
  summary: DeepClaimMenuSummary | null;
  loading?: boolean;
  busy?: boolean;
  error?: string | null;
  cached?: boolean;
  active?: boolean;
  reducedMotion?: boolean;
  reducedGraphics?: boolean;
  onContinue: () => void;
  onNewGame: () => void;
  onJournal: () => void;
  onSettings: () => void;
  onExit: () => void;
  onRetry?: () => void;
  onInteraction?: () => void;
}

export function DeepClaimTitleScreen({ summary, loading = false, busy = false, error, cached = false, active = true, reducedMotion = false, reducedGraphics = false, onContinue, onNewGame, onJournal, onSettings, onExit, onRetry, onInteraction }: DeepClaimTitleScreenProps) {
  const [protectSave, setProtectSave] = useState(false), menu = useRef<HTMLDivElement>(null);
  const hasCompany = !!summary;
  useEffect(() => { if (!hasCompany) setProtectSave(false); }, [hasCompany]);
  function interact() { try { onInteraction?.(); } catch { /* An optional sound cue cannot block navigation. */ } }
  function choose(action: () => void) { interact(); action(); }
  function newGame() { if (loading || busy) return; choose(() => { if (hasCompany) setProtectSave(true); else onNewGame(); }); }
  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (protectSave || event.defaultPrevented) return;
    if (event.key === 'Escape') { event.preventDefault(); choose(onExit); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || !(event.target instanceof HTMLButtonElement) || !event.target.hasAttribute('data-dc-menu-action')) return;
    const controls = [...(menu.current?.querySelectorAll<HTMLButtonElement>('button[data-dc-menu-action]:not(:disabled)') ?? [])];
    const current = controls.indexOf(event.target); if (current < 0 || !controls.length) return;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + controls.length) % controls.length;
    event.preventDefault(); controls[next].focus({ preventScroll: true }); interact();
  }
  const date = summary?.lastSyncedAt ? new Date(summary.lastSyncedAt) : null;
  const synced = date && Number.isFinite(date.getTime()) ? date : null;
  return <section aria-label="Deep Claim title" className="dc-title-screen" data-testid="deep-claim-title" data-dc-menu-loading={loading ? 'true' : 'false'} data-dc-menu-save={hasCompany ? cached ? 'cached' : 'verified' : 'none'} data-dc-reduced-motion={reducedMotion ? 'true' : 'false'} onKeyDown={keyboard}>
    <DeepClaimMenuBackdrop active={active && !protectSave} reducedMotion={reducedMotion} reducedGraphics={reducedGraphics} />
    <div className="dc-title-shade" aria-hidden="true" />
    <div className="dc-title-content">
      <header className="dc-title-brand"><DeepClaimMark decorative className="dc-title-mark" /><div><span className="dc-title-kicker">A Prospector’s Empire</span><h1>DEEP CLAIM</h1></div></header>
      <div className="dc-title-save" aria-live="polite" data-testid="deep-claim-save-summary">
        {loading ? <><span className="dc-title-save-label">Connecting</span><strong>Checking your company…</strong></> : summary ? <><span className="dc-title-save-label">{cached ? <><WifiOff size={12} aria-hidden="true" />Cached company</> : <><ShieldCheck size={12} aria-hidden="true" />Company save</>}</span><strong title={summary.companyName}>{summary.companyName}</strong><div className="dc-title-save-badges" role="group" aria-label="Company save overview"><span><ArrowDownToLine size={13} aria-hidden="true" />{summary.supportedDepth.toLocaleString()} m supported</span><span><Users size={13} aria-hidden="true" />{summary.employeeCount} crew</span>{summary.readyCollections > 0 ? <span className="dc-title-ready"><PackageCheck size={13} aria-hidden="true" />{summary.readyCollections} {summary.readyCollections === 1 ? 'return' : 'returns'} ready</span> : summary.activeExpeditions > 0 ? <span><Pickaxe size={13} aria-hidden="true" />{summary.activeExpeditions} {summary.activeExpeditions === 1 ? 'shift' : 'shifts'} active</span> : null}</div>{cached && <small>Showing your last saved report.</small>}{synced && <time dateTime={synced.toISOString()} title={synced.toLocaleString()}>Last synced {synced.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>}</> : <><span className="dc-title-save-label">New frontier</span><strong>Stake your claim.</strong></>}
      </div>
      <nav className="dc-title-options" aria-label="Deep Claim main menu" ref={menu}>
        <button type="button" data-dc-menu-action="continue" className={hasCompany ? 'dc-title-command is-primary' : 'dc-title-command'} disabled={!hasCompany || loading || busy} onClick={() => choose(onContinue)} aria-label="Continue"><i className="dc-title-command-icon"><Play size={19} aria-hidden="true" /></i><span><b>Continue</b></span><ArrowRight className="dc-title-command-arrow" size={18} aria-hidden="true" /></button>
        <button type="button" data-dc-menu-action="new" className={!hasCompany ? 'dc-title-command is-primary' : 'dc-title-command'} disabled={loading || busy} onClick={newGame} aria-label="New Game"><i className="dc-title-command-icon"><Pickaxe size={19} aria-hidden="true" /></i><span><b>New Game</b>{hasCompany && <small><ShieldCheck size={11} aria-hidden="true" />Existing save protected</small>}</span><ArrowRight className="dc-title-command-arrow" size={18} aria-hidden="true" /></button>
        <button type="button" data-dc-menu-action="journal" className="dc-title-command" onClick={() => choose(onJournal)} aria-label="Tutorial & Field Guide"><i className="dc-title-command-icon"><BookOpen size={19} aria-hidden="true" /></i><span><b>Tutorial &amp; Field Guide</b></span><ArrowRight className="dc-title-command-arrow" size={18} aria-hidden="true" /></button>
        <button type="button" data-dc-menu-action="settings" className="dc-title-command" onClick={() => choose(onSettings)} aria-label="Settings"><i className="dc-title-command-icon"><Settings size={19} aria-hidden="true" /></i><span><b>Settings</b></span><ArrowRight className="dc-title-command-arrow" size={18} aria-hidden="true" /></button>
        <button type="button" data-dc-menu-action="exit" data-dc-tutorial="game-exit" className="dc-title-command" onClick={() => choose(onExit)} aria-label="Return to DH Club"><i className="dc-title-command-icon"><DoorOpen size={19} aria-hidden="true" /></i><span><b>Return to DH Club</b></span><ArrowRight className="dc-title-command-arrow" size={18} aria-hidden="true" /></button>
      </nav>
      {error && <div className="dc-title-status" role="status"><p>{error}</p>{onRetry && <button type="button" onClick={() => choose(onRetry)} disabled={loading}><RefreshCw size={15} aria-hidden="true" />Retry connection</button>}</div>}
      <footer className="dc-title-footer"><span>DRY MY HORSE</span></footer>
    </div>
    <ClaimDialog open={protectSave} onClose={() => setProtectSave(false)} title="Existing company" description="New Game will not replace your save." className="dc-title-save-dialog">
      <div className="dcl-dialog-body"><div className="dc-title-protected-save"><ShieldCheck size={25} aria-hidden="true" /><div><span>Save protected</span><strong>{summary?.companyName}</strong></div></div><p>One company per member, per club. Continue your save or review the tutorial.</p></div>
      <div className="dcl-dialog-actions"><ClaimButton disabled={!hasCompany || loading || busy} onClick={() => { setProtectSave(false); choose(onContinue); }} primary>Continue</ClaimButton><ClaimButton onClick={() => { setProtectSave(false); choose(onJournal); }}>Replay tutorial</ClaimButton><ClaimButton onClick={() => { setProtectSave(false); interact(); }}>Back</ClaimButton></div>
    </ClaimDialog>
  </section>;
}
