import { useCallback, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import type { createDeepClaimAudio } from '@/lib/deepClaim/audio';
import { ClaimButton, ClaimDialog } from './DeepClaimPrimitives';

export interface ClaimVisualPreferences { reducedMotion: boolean; reducedGraphics: boolean }
export function DeepClaimSettings({ audio, visuals, onVisualsChange, onRefresh, refreshing, serverTime, industry = false, field = false, business = false, deep = false }: {
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
}) {
  const [guide, setGuide] = useState(false);
  const [guidePage, setGuidePage] = useState(0);
  const [view, setView] = useState<'sound' | 'visuals' | 'updates'>('sound');
  const guideHeading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const [soundError, setSoundError] = useState('');
  const subscribe = useCallback((listener: () => void) => audio.subscribe(listener), [audio]);
  const snapshot = useCallback(() => audio.getSnapshot(), [audio]);
  const settings = useSyncExternalStore(subscribe, snapshot, snapshot);
  async function toggleMaster() {
    setSoundError('');
    if (settings.master) { audio.updateSettings({ master: false }); return; }
    audio.updateSettings({ master: true });
    // This function runs directly from a user gesture. Sound never auto-unlocks.
    if (!await audio.unlock()) { audio.updateSettings({ master: false }); setSoundError('Sound could not start on this device. Tap Enable sound to try again.'); }
  }
  const views: { key: 'sound' | 'visuals' | 'updates'; label: string }[] = [{ key: 'sound', label: 'Sound' }, { key: 'visuals', label: 'Visuals' }, ...(business ? [{ key: 'updates' as const, label: 'Updates' }] : [])];
  const chapters = [
    { title: 'Explore the frontier', text: 'Exploration reveals new ground. Choose a reachable target and a rested crew, then review the server’s estimate before dispatch.' },
    { title: 'Work a known seam', text: 'Extraction takes resources from finite, revealed deposits. Grades, crew and camp upgrades affect the estimate; the deposit keeps its remaining supply.' },
    { title: 'Give the crew time', text: 'A shift travels, sets up, works, hauls and returns. Wages are paid upfront. Workers have six energy each day and cannot join overlapping crews.' },
    { title: 'Bring the haul home', text: 'Returning cargo stays staged until you collect it into storage. Make space before collecting a large haul or starting another shift.' },
    { title: 'Build your company', text: 'Sell real stock for company credits. Upgrade the office, shaft, warehouse and tool station to open meaningful new possibilities.' },
    ...(industry ? [
      { title: 'Grow the workforce', text: 'Build Workers’ Quarters for more staff, then hire from the day’s fixed roster. Idle workers can take one paid skill course per operating day. Every shift takes at most three workers.' },
      { title: 'Equip for the next shift', text: 'Craft and collect gear, then assign it to an idle worker’s tool, head or utility slot. Condition wears with work; broken gear gives no bonus. Repairs use the listed credits and materials.' },
      { title: 'Work the production benches', text: 'Build a Smeltery or Gem Workshop, or craft at the Tool Station. Starting a batch commits real materials and credits. Each station processes in order; three uncollected jobs can be staged across the company.' },
    ] : []),
    ...(field ? [
      { title: 'Survey and prepare', text: 'Surveys reveal nearby ground from a connected passage without extracting ore. Supports, ventilation and pumps reduce the displayed chance of a short setup delay; haul rail improves covered travel. Installations take a real crew, materials and time.' },
      { title: 'Read the field book', text: 'Confirmed reports explain surveys, completed infrastructure and actual incidents. Crews may recover finite specimens after fully working a deposit. Keep a find, sell it once, or salvage it when every material fits in storage.' },
    ] : []),
    ...(business ? [
      { title: 'Develop the company', text: 'The Company Office keeps research, delivery orders and records together. Paid research completes automatically; its permanent benefit applies to new work. Existing crews and queued batches keep their committed plans.' },
      { title: 'Deliver and recognize progress', text: 'Trading Post orders consume the complete listed collected stock once for a fixed company payout. Orders do not expire. Recorded milestones can be claimed once, including qualifying work completed before the office opened.' },
      { title: 'Choose what the club sees', text: 'Sharing is off until you choose it in the Office’s Club view. Standings publish your company on all three ranking boards. Showcase sharing displays only the kept finds you select. Project contributions commit real stored materials after your review.' },
    ] : []),
    ...(deep ? [{ title: 'Work the Ancient Deep', text: 'Deep Cutting Systems research and Mine Shaft level 6 open supported depth to 999m. The powered lift saves travel only on the known, constructed central shaft. Hot mining reduces productive work, not cargo or crew safety. Engineering, installed ventilation and working crew heat shields reduce the penalty. Survey and installation work are unaffected by heat.' }] : []),
  ];
  const page = Math.min(guidePage, chapters.length - 1);
  const previousGuidePage = useRef(page);
  useLayoutEffect(() => { if (guide && previousGuidePage.current !== page) guideHeading.current?.focus({ preventScroll: true }); previousGuidePage.current = page; }, [guide, page]);
  function turnGuide(next: number) { setGuidePage(next); }
  return <div className="dcl-settings">
    <div className="dcl-section-heading"><div><h2>Camp settings</h2><p>Make the frontier feel right.</p></div></div>
    <div className="dcl-settings-tabs" role="tablist" aria-label="Camp settings views" onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const current = views.findIndex(item => item.key === view); const next = event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + views.length) % views.length; setView(views[next].key); document.getElementById(`${id}-${views[next].key}`)?.focus(); }}>{views.map(item => <button key={item.key} type="button" role="tab" id={`${id}-${item.key}`} aria-controls={`${id}-settings-panel`} aria-selected={view === item.key} tabIndex={view === item.key ? 0 : -1} onClick={() => setView(item.key)}>{item.label}</button>)}</div>
    <div className="dcl-settings-panel dcl-view-enter" key={view} role="tabpanel" id={`${id}-settings-panel`} aria-labelledby={`${id}-${view}`}>
      {view === 'sound' ? <section className="dcl-card dcl-settings-group" aria-label="Sound settings">
        <h3>{settings.master ? <Volume2 size={17} aria-hidden="true" /> : <VolumeX size={17} aria-hidden="true" />}Frontier sound</h3>
        <SettingToggle label="Enable sound" description="Only starts with your touch. Respects DH sound preferences." checked={settings.master} onChange={() => void toggleMaster()} />
        <VolumeControl label="Volume" accessibleLabel="Game sound volume" value={settings.volume} onChange={volume => audio.updateSettings({ volume })} />
        <div className="dcl-sound-bus"><SettingToggle label="Music" checked={settings.music} onChange={() => audio.updateSettings({ music: !settings.music })} /><VolumeControl label="Music mix" accessibleLabel="Music volume" value={settings.musicVolume ?? 1} onChange={musicVolume => audio.updateSettings({ musicVolume })} /></div>
        <div className="dcl-sound-bus"><SettingToggle label="Mining effects" checked={settings.sfx} onChange={() => audio.updateSettings({ sfx: !settings.sfx })} /><VolumeControl label="Effects mix" accessibleLabel="Mining effects volume" value={settings.sfxVolume ?? 1} onChange={sfxVolume => audio.updateSettings({ sfxVolume })} /></div>
        <div className="dcl-sound-bus"><SettingToggle label="Camp ambience" checked={settings.ambient} onChange={() => audio.updateSettings({ ambient: !settings.ambient })} /><VolumeControl label="Ambience mix" accessibleLabel="Camp ambience volume" value={settings.ambientVolume ?? 1} onChange={ambientVolume => audio.updateSettings({ ambientVolume })} /></div>
        {soundError && <p className="dcl-error" role="alert">{soundError}</p>}
      </section> : view === 'visuals' ? <section className="dcl-card dcl-settings-group" aria-label="Visual settings"><h3>Visual comfort</h3><SettingToggle label="Reduced motion" description="Fewer animated details. The crew still progresses." checked={visuals.reducedMotion} onChange={() => onVisualsChange({ reducedMotion: !visuals.reducedMotion })} /><SettingToggle label="Reduced graphics" description="Lighter rendering for smaller devices." checked={visuals.reducedGraphics} onChange={() => onVisualsChange({ reducedGraphics: !visuals.reducedGraphics })} /></section> : <DeepClaimNotificationSetting />}
    </div>
    <section className="dcl-card dcl-settings-actions"><ClaimButton onClick={() => { setGuidePage(0); setGuide(true); }}><BookOpen size={16} aria-hidden="true" />Field guide</ClaimButton><ClaimButton onClick={onRefresh} pending={refreshing}><RefreshCw size={16} aria-hidden="true" />Refresh camp</ClaimButton>{serverTime && <p>Last server check: {new Date(serverTime).toLocaleString()}</p>}</section>
    <ClaimDialog open={guide} onClose={() => setGuide(false)} title="The prospector’s field guide" description="A small crew. A lasting claim." className="dcl-guide-dialog">
      <div className="dcl-guide-progress" role="status">Page {page + 1} of {chapters.length}</div>
      <section className="dcl-guide-page dcl-view-enter" key={page}><BookOpen size={28} aria-hidden="true" /><h3 ref={guideHeading} tabIndex={-1}>{chapters[page].title}</h3><p>{chapters[page].text}</p></section>
      <div className="dcl-guide-controls"><ClaimButton aria-label="Previous guide page" disabled={page === 0} onClick={() => turnGuide(page - 1)}><ArrowLeft size={17} aria-hidden="true" />Previous</ClaimButton><ClaimButton aria-label="Next guide page" disabled={page === chapters.length - 1} onClick={() => turnGuide(page + 1)}>Next<ArrowRight size={17} aria-hidden="true" /></ClaimButton></div>
      <ClaimButton primary onClick={() => setGuide(false)}>Back to camp</ClaimButton>
    </ClaimDialog>
  </div>;

}

function SettingToggle({ label, description, checked, onChange, disabled = false }: { label: string; description?: string; checked: boolean; onChange: () => void; disabled?: boolean }) {
  return <label className="dcl-setting-toggle"><span><strong>{label}</strong>{description && <small>{description}</small>}</span><button type="button" role="switch" disabled={disabled} aria-checked={checked} aria-label={label} onClick={onChange}><i /></button></label>;
}

function DeepClaimNotificationSetting() {
  const { prefs, loading, saving, error, update, refresh } = useNotificationPreferences();
  const [failure, setFailure] = useState('');
  async function toggle() { setFailure(''); try { await update('deep_claim', !prefs.deep_claim); } catch (issue) { setFailure(issue instanceof Error ? issue.message : 'Notification preferences could not sync. Retry the setting.'); } }
  return <section className="dcl-card dcl-settings-group" aria-label="Deep Claim notification settings"><h3>Camp updates</h3><SettingToggle label="Deep Claim notifications" description="In-app updates for confirmed returns, production, research and club projects. Sharing remains a separate choice." checked={prefs.deep_claim} disabled={loading || saving} onChange={() => void toggle()} />{(failure || error) && <><p className="dcl-error" role="alert">{failure || error}</p><ClaimButton className="is-small" onClick={() => void refresh()}>Retry notification preferences</ClaimButton></>}</section>;
}

function VolumeControl({ label, accessibleLabel, value, onChange }: { label: string; accessibleLabel: string; value: number; onChange: (value: number) => void }) {
  return <label className="dcl-volume">{label}<span>{Math.round(value * 100)}%</span><input type="range" min="0" max="100" step="5" value={Math.round(value * 100)} onChange={event => onChange(Number(event.target.value) / 100)} aria-label={accessibleLabel} /></label>;
}
