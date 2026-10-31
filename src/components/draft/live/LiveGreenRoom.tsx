import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock3, Copy, Link2, MonitorPlay, Radio, Settings2, Share2, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { toast } from 'sonner';
import { LiveDraftSettingsSheet } from './LiveDraftSettingsSheet';
import { formatClock, kioskPath, kioskUrl, TIMEOUT_BEHAVIOR_LABELS, type LiveDraftSettings } from '@/lib/draft/liveDraft';
import { draftInitials } from '@/lib/draft/presentation';

export interface LiveGreenRoomProps {
  draftId: string;
  topic: string;
  participants: Array<{ id?: string; user_id: string; profiles?: { display_name?: string | null } | null }>;
  settings: LiveDraftSettings;
  canManage: boolean;
  busy: boolean;
  canStart: boolean;
  onStart: () => void | Promise<void>;
  onSaveSettings: (patch: Partial<LiveDraftSettings>) => Promise<void> | void;
  kioskCode?: string | null;
  connectionStatus: string;
  ceremonyEnabled?: boolean;
  children?: ReactNode;
}

const CONNECTION_LABELS: Record<string, string> = {
  connecting: 'Connecting to live updates',
  connected: 'Live updates connected',
  disconnected: 'Live updates disconnected',
  error: 'Live updates interrupted',
};

/** Event staging only. Joining, permissions and starting stay with the parent. */
export function LiveGreenRoom({
  draftId, topic, participants, settings, canManage, busy, canStart,
  onStart, onSaveSettings, kioskCode, connectionStatus, ceremonyEnabled, children,
}: LiveGreenRoomProps) {
  const headingId = useId();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const roster = [...new Map(participants.map((participant) => [participant.user_id, participant])).values()];
  const minimumMet = roster.length >= 2;
  const usesCeremony = ceremonyEnabled ?? settings.ceremony;
  const playerPath = `/drafts/live/${encodeURIComponent(draftId)}`;
  const playerUrl = new URL(playerPath, kioskUrl(draftId)).href;
  const codePath = kioskCode ? `/drafts/live?code=${encodeURIComponent(kioskCode)}` : undefined;
  const connected = connectionStatus === 'connected';

  const copyPlayerInvite = async () => {
    try {
      await navigator.clipboard.writeText(playerUrl);
      toast.success('Player invite copied');
    } catch {
      toast.error('Could not copy the player invite');
    }
  };
  const copyProjector = async () => {
    try {
      await navigator.clipboard.writeText(kioskUrl(draftId));
      toast.success('Projector link copied');
    } catch {
      toast.error('Could not copy the projector link');
    }
  };
  const sharePlayerInvite = async () => {
    try {
      await navigator.share({ title: topic, text: 'Join this live draft on your own phone.', url: playerUrl });
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return;
      toast.error('Sharing could not open. Copy the player invite instead.');
    }
  };

  return (
    <section className="da-greenroom min-w-0" aria-labelledby={headingId}>
      <header className="da-greenroom-hero">
        <p className="da-greenroom-eyebrow"><Radio size={14} aria-hidden="true" />Live draft<span>Green room</span></p>
        <h2 id={headingId} className="dl-display" title={topic}>{topic}</h2>
        <p>{canManage ? 'Bring your players together. Set the stage, then start the draft.' : 'Take your seat. The host will start the draft.'}</p>
      </header>

      <div className="da-greenroom-readiness" role="status">
        <span><Users size={16} aria-hidden="true" /><b>{roster.length}</b> {roster.length === 1 ? 'player' : 'players'} in the room</span>
        <span className={minimumMet && canStart ? 'is-ready' : ''}>
          {minimumMet ? <Check size={15} aria-hidden="true" /> : <Users size={15} aria-hidden="true" />}
          {minimumMet ? canStart ? 'Roster ready' : 'Players gathered' : `${2 - roster.length} more ${roster.length === 1 ? 'player' : 'players'} needed`}
        </span>
        <span className="da-greenroom-connection" data-connection={connectionStatus} data-connected={connected}>
          <i aria-hidden="true" />{CONNECTION_LABELS[connectionStatus] ?? 'Connecting to live updates'}
        </span>
      </div>

      <div className="da-greenroom-body">
      <div className="da-greenroom-main">
        <section className="da-greenroom-roster" aria-label="Players in the room">
          <header><h3 className="dl-display">The lineup</h3><span>{roster.length} joined</span></header>
          {roster.length ? <ul>{roster.map((participant) => {
            const name = participant.profiles?.display_name?.trim() || 'Player';
            const initials = draftInitials(name);
            return <li key={participant.user_id}>
              <span className="da-greenroom-avatar" aria-hidden="true">{initials}</span>
              <span title={name}>{name}</span>
            </li>;
          })}</ul> : <p className="da-greenroom-empty">The first seat is waiting. Send the player invitation to your club.</p>}
        </section>

        <section className="da-greenroom-rules" aria-label="Live draft rules">
          <article><Clock3 aria-hidden="true" /><span>{settings.timeoutBehavior === 'none' ? 'Clock reference' : 'Time per pick'}</span><strong>{formatClock(settings.pickSeconds * 1000)}</strong></article>
          <article><ShieldCheck aria-hidden="true" /><span>At zero</span><strong>{TIMEOUT_BEHAVIOR_LABELS[settings.timeoutBehavior]}</strong></article>
          <article><Sparkles aria-hidden="true" /><span>Order reveal</span><strong>{usesCeremony ? 'Before the first pick' : 'Direct to the draft'}</strong></article>
          <p>{settings.autoStartClock ? 'The next clock starts automatically after each selection.' : 'The host starts each pick clock.'}</p>
        </section>
      </div>


      <div className="da-greenroom-share-grid">
        <section className="da-greenroom-player-invite" aria-label="Player invitation">
          <header><Users aria-hidden="true" /><div><h3 className="dl-display">Invite players</h3><p>Send this link to players on their own phones.</p></div></header>
          <Link to={playerPath} className="da-greenroom-invite-url" title={playerUrl}>{playerUrl}</Link>
          <div className="da-greenroom-share-actions">
            <button type="button" onClick={() => void copyPlayerInvite()} className="dl-host-btn"><Copy size={16} aria-hidden="true" />Copy player invite</button>
            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && <button type="button" onClick={() => void sharePlayerInvite()} className="dl-host-btn"><Share2 size={16} aria-hidden="true" />Share player invite</button>}
          </div>
          {kioskCode && codePath && <div className="da-greenroom-code"><span>Room code</span><code>{kioskCode}</code><Link to={codePath}>Join with this code</Link></div>}
        </section>

        {canManage && <section className="da-greenroom-projector" aria-label="Optional projector">
          <header><MonitorPlay aria-hidden="true" /><div><h3 className="dl-display">Projector <span>Optional</span></h3><p>A separate view for your shared screen.</p></div></header>
          <div className="da-greenroom-share-actions">
            <Link to={kioskPath(draftId)} target="_blank" rel="noreferrer" className="dl-host-btn"><MonitorPlay size={16} aria-hidden="true" />Open projector</Link>
            <button type="button" onClick={() => void copyProjector()} className="dl-host-btn"><Link2 size={16} aria-hidden="true" />Copy projector link</button>
          </div>
        </section>}
      </div>

      </div>

      <footer className="da-greenroom-actions">
      {children && <div className="da-greenroom-membership">{children}</div>}

        {canManage ? <>
          <button type="button" disabled={busy} className="dl-host-btn" onClick={() => setSettingsOpen(true)}><Settings2 size={16} aria-hidden="true" />Configure live draft</button>
          <button type="button" disabled={busy || !canStart || !minimumMet} className="da-cta min-h-11" onClick={() => void onStart()}>
            <Sparkles size={17} aria-hidden="true" />{busy ? 'Starting…' : usesCeremony ? 'Start order reveal' : 'Begin live draft'}
          </button>
          {!minimumMet && <p>At least two players must join before the draft can start.</p>}
        </> : <p>The host controls settings and starts the draft.</p>}
      </footer>

      {canManage && <LiveDraftSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onSave={onSaveSettings} />}
    </section>
  );
}
