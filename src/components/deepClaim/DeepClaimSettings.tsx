import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Bell, BookOpen, Check, Minus, Palette, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import type { createDeepClaimAudio } from '@/lib/deepClaim/audio';
import { ClaimButton, ClaimDialog } from './DeepClaimPrimitives';
import { TutorialHelp, useDeepClaimTutorialEvents, useTutorialView } from './tutorial/events';
import { DeepClaimBusinessIcon } from './renderer/DeepClaimIcons';
import './deepClaimWorkforceMenus.css';

export interface ClaimVisualPreferences { reducedMotion: boolean; reducedGraphics: boolean }
export interface ClaimSettingsViewRequest { id: string; view: 'sound' | 'visuals' | 'updates' }
export function DeepClaimSettings({ audio, visuals, onVisualsChange, onRefresh, refreshing, serverTime, industry = false, field = false, business = false, deep = false, onOpenJournal, onMainMenu, viewRequest }: {
  audio: ReturnType<typeof createDeepClaimAudio>;
  visuals: ClaimVisualPreferences;
  onVisualsChange: (patch: Partial<ClaimVisualPreferences>) => void;
  onRefresh: () => void;
  refreshing: boolean;
  serverTime?: string;
  industry?: boolean;
  field?: boolean;
  business?: boolean;
  deep?: boolean;
  onOpenJournal?: () => void;
  onMainMenu?: () => void;
  viewRequest?: ClaimSettingsViewRequest;
}) {
  const tutorial = useDeepClaimTutorialEvents();
  const [guide, setGuide] = useState(false);
  const [guidePage, setGuidePage] = useState(0);
  const [view, setView] = useState<'sound' | 'visuals' | 'updates'>('sound');
  const activeView = view === 'updates' && !business ? 'sound' : view;
  useEffect(() => { if (!business) setView(current => current === 'updates' ? 'sound' : current); }, [business]);
  const handledView = useRef<string | null>(null);
  useEffect(() => {
    if (!viewRequest || handledView.current === viewRequest.id || viewRequest.view === 'updates' && !business) return;
    handledView.current = viewRequest.id;
    setGuide(false); setView(viewRequest.view);
  }, [viewRequest, business]);
  useTutorialView('settings_opened', { view: activeView }, `settings:${activeView}`);
  const openJournal = onOpenJournal ?? (tutorial.available ? () => tutorial.openJournal() : undefined);
  const mainMenu = onMainMenu ?? tutorial.mainMenu;
  const guideHeading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const [soundError, setSoundError] = useState('');
  const [soundStarting, setSoundStarting] = useState(false);
  const soundPending = useRef(false);
  const soundLifetime = useRef({ active: true });
  const currentAudio = useRef(audio); currentAudio.current = audio;
  useEffect(() => {
    const lifetime = { active: true }; soundLifetime.current = lifetime;
    soundPending.current = false; setSoundStarting(false); setSoundError('');
    return () => { lifetime.active = false; };
  }, [audio]);
  const subscribe = useCallback((listener: () => void) => audio.subscribe(listener), [audio]);
  const snapshot = useCallback(() => audio.getSnapshot(), [audio]);
  const settings = useSyncExternalStore(subscribe, snapshot, snapshot);
  async function toggleMaster() {
    if (soundPending.current) return;
    setSoundError('');
    if (audio.getSnapshot().master) { audio.updateSettings({ master: false }); return; }
    const lifetime = soundLifetime.current;
    const isCurrent = () => lifetime.active && currentAudio.current === audio;
    soundPending.current = true; setSoundStarting(true);
    audio.updateSettings({ master: true });
    // This function runs directly from a user gesture. Sound never auto-unlocks.
    try {
      if (!await audio.unlock() && isCurrent()) {
        audio.updateSettings({ master: false });
        setSoundError('Sound could not start on this device. Tap Enable sound to try again.');
      }
    } catch {
      if (isCurrent()) {
        audio.updateSettings({ master: false });
        setSoundError('Sound could not start on this device. Tap Enable sound to try again.');
      }
    } finally {
      if (isCurrent()) { soundPending.current = false; setSoundStarting(false); }
    }
  }
  const views: { key: 'sound' | 'visuals' | 'updates'; label: string }[] = [{ key: 'sound', label: 'Sound' }, { key: 'visuals', label: 'Visuals' }, ...(business ? [{ key: 'updates' as const, label: 'Updates' }] : [])];
  const chapters = [
    { title: 'Expand tunnels', text: 'Dig new connected passages and uncover more of the mine. Open routes stay open. Any minerals recovered depend on the ground and crew; a full haul is not guaranteed.' },
    { title: 'Mine a deposit', text: 'Work a known deposit for its remaining materials. Check the estimated haul and route before dispatch. Deposits are finite and do not refill.' },
    { title: 'Expeditions', text: 'A shift travels, sets up, works, hauls and returns. Wages are paid upfront. Workers have six energy each day and cannot join overlapping crews.' },
    { title: 'Hauling', text: 'Returning cargo stays staged until you collect it into storage. Make space before collecting a large haul or starting another shift.' },
    { title: 'Buildings', text: 'Sell stock for company credits. Upgrade the office, shaft, warehouse and tool station to add crews, depth, storage and equipment.' },
    ...(industry ? [
      { title: 'Hiring', text: 'Build Workers’ Quarters for more staff, then hire from the day’s fixed roster. Idle workers can take one paid skill course per operating day. Every shift takes at most three workers.' },
      { title: 'Equipment', text: 'Craft and collect gear, then assign it to an idle worker’s tool, head or utility slot. Condition wears with work; broken gear gives no bonus. Repairs use the listed credits and materials.' },
      { title: 'Production', text: 'Build a Smeltery or Gem Workshop, or craft at the Tool Station. Starting a batch commits real materials and credits. Each station processes in order; three uncollected jobs can be staged across the company.' },
    ] : []),
    ...(field ? [
      { title: 'Scout and improve', text: 'Scout the area reveals nearby ground without digging or bringing back ore or specimens. Improve the mine uses a crew, materials and a fee to install lasting local protection or rail. Rail leaves more work time within the same shift; the return timer stays the same.' },
      { title: 'Discoveries', text: 'Reports record scouting, finished improvements and incidents. Fully mining a deposit may recover a specimen. Keep it, sell it once or salvage it when all the materials fit in storage.' },
    ] : []),
    ...(business ? [
      { title: 'Research', text: 'The Company Office keeps research, delivery orders and records together. Paid research completes automatically; its permanent benefit applies to new work. Existing crews and queued batches keep their committed plans.' },
      { title: 'Contracts and milestones', text: 'Trading Post orders consume the complete listed collected stock once for a fixed company payout. Orders do not expire. Recorded milestones can be claimed once, including qualifying work completed before the office opened.' },
      { title: 'Club sharing', text: 'Sharing is off until you choose it in the Office’s Club view. Standings publish your company on all three ranking boards. Showcase sharing displays only the kept finds you select. Project contributions commit real stored materials after your review.' },
    ] : []),
    ...(deep ? [{ title: 'Ancient Deep', text: 'Deep Cutting Systems research and Mine Shaft level 6 open access to 999m. The lift frees work time on the built central shaft without shortening the shift. Engineering, ventilation and working heat shields reduce the mining heat penalty. Scouting and installations are unaffected.' }] : []),
  ];
  const page = Math.min(guidePage, chapters.length - 1);
  useTutorialView('guide_reviewed', guide ? { view: 'field_guide', record_id: `page:${page}` } : null, `field-guide:${guide}:${page}`);
  const previousGuidePage = useRef(page);
  useLayoutEffect(() => { if (guide && previousGuidePage.current !== page) guideHeading.current?.focus({ preventScroll: true }); previousGuidePage.current = page; }, [guide, page]);
  function turnGuide(next: number) { setGuidePage(next); }
  return <div className="dcl-settings">
    <div className="dcl-section-heading"><div className="dcl-settings-title"><DeepClaimBusinessIcon kind="office" decorative /><div><h2>Settings</h2></div></div><TutorialHelp lessonId={activeView === 'updates' ? 'club.updates' : 'settings.sound'} label={activeView === 'updates' ? 'Camp updates' : 'Sound and visuals'} /></div>
    <div className="dcl-settings-tabs" role="tablist" aria-label="Camp settings views" onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const current = views.findIndex(item => item.key === activeView); const next = event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + views.length) % views.length; setView(views[next].key); document.getElementById(`${id}-${views[next].key}`)?.focus(); }}>{views.map(item => <button key={item.key} data-dc-tutorial={`settings-${item.key}`} type="button" role="tab" id={`${id}-${item.key}`} aria-controls={`${id}-settings-panel`} aria-selected={activeView === item.key} tabIndex={activeView === item.key ? 0 : -1} onClick={() => setView(item.key)}>{item.key === 'sound' ? <Volume2 size={16} aria-hidden="true" /> : item.key === 'visuals' ? <Palette size={16} aria-hidden="true" /> : <Bell size={16} aria-hidden="true" />}{item.label}</button>)}</div>
    <div className="dcl-settings-panel dcl-view-enter" key={activeView} role="tabpanel" id={`${id}-settings-panel`} aria-labelledby={`${id}-${activeView}`}>
      {activeView === 'sound' ? <section className="dcl-card dcl-settings-group" aria-label="Sound settings">
        <header className="dcl-settings-group-title"><h3>{settings.master ? <Volume2 size={20} aria-hidden="true" /> : <VolumeX size={20} aria-hidden="true" />}Sound</h3><span data-enabled={settings.master} role="status">{soundStarting ? 'Starting…' : settings.master ? 'On' : 'Off'}</span></header>
        <SettingToggle label="Enable sound" description="Starts on tap; follows DH sound preferences." checked={settings.master} disabled={soundStarting} pending={soundStarting} onChange={() => void toggleMaster()} />
        <VolumeControl label="Volume" accessibleLabel="Game sound volume" value={settings.volume} onChange={volume => audio.updateSettings({ volume })} />
        <div className="dcl-sound-bus"><SettingToggle label="Music" checked={settings.music} onChange={() => audio.updateSettings({ music: !settings.music })} /><VolumeControl label="Music mix" accessibleLabel="Music volume" value={settings.musicVolume ?? 1} onChange={musicVolume => audio.updateSettings({ musicVolume })} /></div>
        <div className="dcl-sound-bus"><SettingToggle label="Mining effects" checked={settings.sfx} onChange={() => audio.updateSettings({ sfx: !settings.sfx })} /><VolumeControl label="Effects mix" accessibleLabel="Mining effects volume" value={settings.sfxVolume ?? 1} onChange={sfxVolume => audio.updateSettings({ sfxVolume })} /></div>
        <div className="dcl-sound-bus"><SettingToggle label="Camp ambience" checked={settings.ambient} onChange={() => audio.updateSettings({ ambient: !settings.ambient })} /><VolumeControl label="Ambience mix" accessibleLabel="Camp ambience volume" value={settings.ambientVolume ?? 1} onChange={ambientVolume => audio.updateSettings({ ambientVolume })} /></div>
        {soundError && <p className="dcl-error" role="alert">{soundError}</p>}
      </section> : activeView === 'visuals' ? <section className="dcl-card dcl-settings-group" aria-label="Visual settings"><h3>Graphics</h3>{typeof tutorial.commentaryEnabled === 'boolean' && tutorial.onCommentaryChange && <SettingToggle label="Gus commentary" description="Conversations only. Guidance and Ask Gus stay available." checked={tutorial.commentaryEnabled} onChange={() => tutorial.onCommentaryChange?.(!tutorial.commentaryEnabled)} />}<SettingToggle label="Reduced motion" description="Fewer animations; mining continues." checked={visuals.reducedMotion} onChange={() => onVisualsChange({ reducedMotion: !visuals.reducedMotion })} /><SettingToggle label="Reduced graphics" description="Lower detail to improve performance." checked={visuals.reducedGraphics} onChange={() => onVisualsChange({ reducedGraphics: !visuals.reducedGraphics })} /></section> : <DeepClaimNotificationSetting />}
    </div>
    <section className="dcl-card dcl-settings-actions">{openJournal && <ClaimButton data-dc-tutorial="training-journal" onClick={openJournal}><BookOpen size={16} aria-hidden="true" />Training Journal</ClaimButton>}<ClaimButton onClick={() => { setGuidePage(0); setGuide(true); }}><BookOpen size={16} aria-hidden="true" />Field guide</ClaimButton><ClaimButton onClick={onRefresh} pending={refreshing}><RefreshCw size={16} aria-hidden="true" />Refresh camp</ClaimButton>{mainMenu && <ClaimButton data-dc-tutorial="settings-main-menu" onClick={mainMenu}>Return to Main Menu</ClaimButton>}{mainMenu && <p>Shifts keep running. Finish pending actions before leaving.</p>}{serverTime && <p>Last synced: {new Date(serverTime).toLocaleString()}</p>}</section>
    <ClaimDialog open={guide} onClose={() => setGuide(false)} title="Field guide" className="dcl-guide-dialog">
      <div className="dcl-guide-progress" role="status">Page {page + 1} of {chapters.length}</div>
      <section className="dcl-guide-page dcl-view-enter" key={page}><BookOpen size={28} aria-hidden="true" /><h3 ref={guideHeading} tabIndex={-1}>{chapters[page].title}</h3><p>{chapters[page].text}</p></section>
      <div className="dcl-guide-controls"><ClaimButton aria-label="Previous guide page" disabled={page === 0} onClick={() => turnGuide(page - 1)}><ArrowLeft size={17} aria-hidden="true" />Previous</ClaimButton><ClaimButton aria-label="Next guide page" disabled={page === chapters.length - 1} onClick={() => turnGuide(page + 1)}>Next<ArrowRight size={17} aria-hidden="true" /></ClaimButton></div>
      <ClaimButton primary onClick={() => setGuide(false)}>Back to camp</ClaimButton>
    </ClaimDialog>
  </div>;

}

function SettingToggle({ label, description, checked, onChange, disabled = false, pending = false }: { label: string; description?: string; checked: boolean; onChange: () => void; disabled?: boolean; pending?: boolean }) {
  return <label className="dcl-setting-toggle"><span><strong>{label}</strong>{description && <small>{description}</small>}</span><button type="button" role="switch" disabled={disabled} aria-busy={pending || undefined} aria-checked={checked} aria-label={label} onClick={onChange}><i aria-hidden="true">{checked ? <Check size={12} /> : <Minus size={12} />}</i></button></label>;
}

function DeepClaimNotificationSetting() {
  const { prefs, loading, saving, error, update, refresh } = useNotificationPreferences();
  const [failure, setFailure] = useState('');
  async function toggle() { setFailure(''); try { await update('deep_claim', !prefs.deep_claim); } catch (issue) { setFailure(issue instanceof Error ? issue.message : 'Notification preferences could not sync. Retry the setting.'); } }
  return <section className="dcl-card dcl-settings-group" aria-label="Deep Claim notification settings"><h3>Notifications</h3><SettingToggle label="Deep Claim notifications" description="Returns, production, research and club projects. Sharing is separate." checked={prefs.deep_claim} disabled={loading || saving} onChange={() => void toggle()} />{(failure || error) && <><p className="dcl-error" role="alert">{failure || error}</p><ClaimButton className="is-small" onClick={() => void refresh()}>Retry notification preferences</ClaimButton></>}</section>;
}

function VolumeControl({ label, accessibleLabel, value, onChange }: { label: string; accessibleLabel: string; value: number; onChange: (value: number) => void }) {
  return <label className="dcl-volume" style={{ '--dcl-volume-fill': `${Math.max(0, Math.min(100, value * 100))}%` } as CSSProperties}>{label}<span>{Math.round(value * 100)}%</span><input type="range" min="0" max="100" step="5" value={Math.round(value * 100)} onChange={event => onChange(Number(event.target.value) / 100)} aria-label={accessibleLabel} /></label>;
}
