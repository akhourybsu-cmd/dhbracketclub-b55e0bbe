import { useCallback, useState, useSyncExternalStore } from 'react';
import { BookOpen, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import type { createDeepClaimAudio } from '@/lib/deepClaim/audio';
import { ClaimButton, ClaimDialog } from './DeepClaimPrimitives';

export interface ClaimVisualPreferences { reducedMotion: boolean; reducedGraphics: boolean }
export function DeepClaimSettings({ audio, visuals, onVisualsChange, onRefresh, refreshing, serverTime, industry = false, field = false, business = false }: {
  audio: ReturnType<typeof createDeepClaimAudio>;
  visuals: ClaimVisualPreferences;
  onVisualsChange: (patch: Partial<ClaimVisualPreferences>) => void;
  onRefresh: () => void;
  refreshing: boolean;
  serverTime?: string;
  industry?: boolean;
  field?: boolean;
  business?: boolean;
}) {
  const [guide, setGuide] = useState(false);
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
  return <>
    <div className="dcl-section-heading"><div><h2>Camp settings</h2><p>Comfort and sound for this device.</p></div></div>
    <section className="dcl-card dcl-settings-group" aria-label="Sound settings">
      <h3>{settings.master ? <Volume2 size={17} aria-hidden="true" /> : <VolumeX size={17} aria-hidden="true" />}Frontier sound</h3>
      <SettingToggle label="Enable sound" description="Starts only when you choose. Respects your DH sound preferences." checked={settings.master} onChange={() => void toggleMaster()} />
      <SettingToggle label="Music" checked={settings.music} onChange={() => audio.updateSettings({ music: !settings.music })} />
      <SettingToggle label="Mining effects" checked={settings.sfx} onChange={() => audio.updateSettings({ sfx: !settings.sfx })} />
      <SettingToggle label="Camp ambience" checked={settings.ambient} onChange={() => audio.updateSettings({ ambient: !settings.ambient })} />
      <label className="dcl-volume">Volume <span>{Math.round(settings.volume * 100)}%</span><input type="range" min="0" max="100" step="5" value={Math.round(settings.volume * 100)} onChange={event => audio.updateSettings({ volume: Number(event.target.value) / 100 })} aria-label="Game sound volume" /></label>
      {soundError && <p className="dcl-error" role="alert">{soundError}</p>}
    </section>
    <section className="dcl-card dcl-settings-group" aria-label="Visual settings"><h3>Visual comfort</h3><SettingToggle label="Reduced motion" description="Keeps the mine readable with fewer animated details." checked={visuals.reducedMotion} onChange={() => onVisualsChange({ reducedMotion: !visuals.reducedMotion })} /><SettingToggle label="Reduced graphics" description="Lighter rendering for smaller devices." checked={visuals.reducedGraphics} onChange={() => onVisualsChange({ reducedGraphics: !visuals.reducedGraphics })} /></section>
    {business && <DeepClaimNotificationSetting />}
    <section className="dcl-card dcl-settings-actions"><ClaimButton onClick={() => setGuide(true)}><BookOpen size={16} aria-hidden="true" />Field guide</ClaimButton><ClaimButton onClick={onRefresh} pending={refreshing}><RefreshCw size={16} aria-hidden="true" />Refresh camp</ClaimButton>{serverTime && <p>Last server check: {new Date(serverTime).toLocaleString()}</p>}</section>
    <ClaimDialog open={guide} onClose={() => setGuide(false)} title="The prospector’s field guide" description="A small crew. A lasting claim."><div className="dcl-guide"><section><b>01 · Survey the frontier</b><p>Exploration reveals new ground. Choose a reachable target and a rested crew, then review the server’s estimate before dispatch.</p></section><section><b>02 · Work a known seam</b><p>Extraction takes resources from finite, revealed deposits. Grades, crew and camp upgrades affect the estimate; the deposit keeps its remaining supply.</p></section><section><b>03 · Give the crew time</b><p>A shift travels, sets up, works, hauls and returns. Wages are paid upfront. Workers have six energy each day and cannot join overlapping crews.</p></section><section><b>04 · Bring the haul home</b><p>Returning cargo stays staged until you collect it into storage. Make space before collecting a large haul or starting another shift.</p></section><section><b>05 · Build your company</b><p>Sell real stock for company credits. Upgrade the office, shaft, warehouse and tool station to open meaningful new possibilities.</p></section>{industry && <><section><b>06 · Grow the workforce</b><p>Build Workers’ Quarters for more staff, then hire from the day’s fixed roster. Idle workers can take one paid skill course per operating day. Every shift still takes at most three workers.</p></section><section><b>07 · Equip for the next shift</b><p>Craft and collect gear, then assign it to an idle worker’s tool, head or utility slot. Condition wears with work; broken gear gives no bonus. Repairs use the listed credits and materials.</p></section><section><b>08 · Work the production benches</b><p>Build a Smeltery or Gem Workshop, or craft at the Tool Station. Starting a batch commits real materials and credits. Each station processes in order; three uncollected jobs can be staged across the company.</p></section></>}{field && <><section><b>09 · Survey and prepare</b><p>Surveys reveal nearby ground from a connected passage without extracting ore. Supports, ventilation and pumps reduce the displayed chance of a short setup delay; haul rail improves travel. Installations take a real crew, materials and time.</p></section><section><b>10 · Read the field book</b><p>Confirmed reports explain surveys, completed infrastructure and actual incidents. Mining crews may recover finite specimens after fully working a deposit. Keep a find in the cabinet, sell it once, or salvage it only when every material fits in storage.</p></section></>}{business && <><section><b>11 · Develop the company</b><p>The Company Office keeps research, delivery orders and records together. A paid research project completes automatically; its permanent benefit applies to new work. Existing crews and queued batches keep their committed plans.</p></section><section><b>12 · Deliver and recognize progress</b><p>Trading Post orders consume the complete listed collected stock once for a fixed company payout. Orders do not expire. Recorded company milestones can be claimed once, including qualifying work completed before the office opened.</p></section></>}</div><ClaimButton primary onClick={() => setGuide(false)}>Back to camp</ClaimButton></ClaimDialog>
  </>;
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
