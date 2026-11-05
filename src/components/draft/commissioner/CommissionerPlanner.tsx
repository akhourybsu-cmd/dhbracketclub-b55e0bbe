import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarDays, Copy, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDraftArenaPalette } from '@/hooks/useDraftArenaPalette';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DEFAULT_LIVE_SETTINGS, PICK_SECONDS_OPTIONS, TIMEOUT_BEHAVIOR_LABELS, parseLiveSettings, type LiveDraftSettings, type PickTimeoutBehavior } from '@/lib/draft/liveDraft';
import type { CommissionerAction, CommissionerMutate, CommissionerPlan, CommissionerPreset, CommissionerPresetConfig, CommissionerWorkspaceData } from '@/lib/draft/commissioner';

interface CommissionerPlannerProps {
  clubId: string;
  seasonId: string | null;
  data: (Pick<CommissionerWorkspaceData, 'plans' | 'presets' | 'reminders'> & Partial<Pick<CommissionerWorkspaceData, 'drafts'>>) | null;
  mutate: CommissionerMutate;
  busy?: boolean;
  readOnly?: boolean;
  recipients?: { userId: string; name: string }[];
}
interface Rules {
  numRounds: number;
  aiContext: string;
  isLive: boolean;
  liveSettings: LiveDraftSettings;
}
interface PlanEditor extends Rules {
  kind: 'plan'; original?: CommissionerPlan; topic: string; notes: string;
  scheduled: string; due: string; status: CommissionerPlan['status']; presetId: string | null; draftId: string | null; reason: string;
}
interface PresetEditor extends Rules {
  kind: 'preset'; original?: CommissionerPreset; name: string; topic: string; description: string; reason: string;
}
type Editor = PlanEditor | PresetEditor;
type Prompt = { kind: 'delete_plan' | 'delete_preset' | 'send_reminder'; id: string; title: string; version: number; reason: string; recipient: string };

function localDate(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function timestamp(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Choose a valid date and time.');
  return date.toISOString();
}
function displayDate(value: string | null) {
  if (!value) return 'Date to be decided';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Date to be decided';
}
function rules(config?: Partial<CommissionerPresetConfig>): Rules {
  return { numRounds: config?.num_rounds ?? 5, aiContext: config?.ai_context ?? '', isLive: config?.is_live ?? false, liveSettings: parseLiveSettings(config?.live_settings ?? DEFAULT_LIVE_SETTINGS) };
}
function newPlan(preset?: CommissionerPreset): PlanEditor {
  return { kind: 'plan', topic: preset?.config.topic ?? '', notes: preset?.config.description ?? '', scheduled: '', due: '', status: 'planned', presetId: preset?.id ?? null, draftId: null, reason: '', ...rules(preset?.config) };
}
function planEditor(plan: CommissionerPlan): PlanEditor {
  return { kind: 'plan', original: plan, topic: plan.topic, notes: plan.notes, scheduled: localDate(plan.scheduled_at), due: localDate(plan.due_at), status: plan.status, presetId: plan.preset_id, draftId: plan.draft_id, reason: '', ...rules(plan) };
}
function presetEditor(preset?: CommissionerPreset): PresetEditor {
  return { kind: 'preset', original: preset, name: preset?.name ?? '', topic: preset?.config.topic ?? '', description: preset?.config.description ?? '', reason: '', ...rules(preset?.config) };
}
const LIVE_TOGGLES: [keyof Pick<LiveDraftSettings, 'announce' | 'ticker' | 'sound' | 'ceremony' | 'broadcast' | 'autoStartClock' | 'reportBroadcast'>, string][] = [
  ['announce', 'Announce picks'], ['ticker', 'Recent-pick ticker'], ['sound', 'Projector sound'], ['ceremony', 'Order ceremony'],
  ['broadcast', 'Broadcast moments'], ['autoStartClock', 'Start each clock automatically'], ['reportBroadcast', 'Broadcast the scored report'],
];

function PlannerRules({ value, disabled, change }: { value: Rules; disabled: boolean; change: (next: Rules) => void }) {
  return <fieldset disabled={disabled} className="da-planner-rules space-y-3">
    <label className="block text-xs font-bold">Rounds
      <select className="form-input mt-1 min-h-11 w-full" value={value.numRounds} onChange={(event) => change({ ...value, numRounds: Number(event.target.value) })}>
        {Array.from({ length: 20 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} picks each</option>)}
      </select>
    </label>
    <label className="block text-xs font-bold">Judging instructions (optional)
      <Textarea className="mt-1 resize-none" rows={3} maxLength={1000} value={value.aiContext} onChange={(event) => change({ ...value, aiContext: event.target.value })} />
    </label>
    <p className="text-[11px] leading-snug text-muted-foreground">Instructions clarify the topic. The existing draft scoring system stays the same.</p>
    <label className="flex min-h-11 items-center gap-3 text-xs font-bold"><input type="checkbox" checked={value.isLive} onChange={(event) => change({ ...value, isLive: event.target.checked })} />LIVE event</label>
    {value.isLive && <details className="da-planner-live rounded-xl border border-border p-3">
      <summary className="min-h-11 cursor-pointer text-xs font-bold">LIVE stage settings · {value.liveSettings.pickSeconds}s</summary>
      <div className="space-y-3">
        <label className="block text-xs font-bold">Pick clock
          <select className="form-input mt-1 min-h-11 w-full" value={value.liveSettings.pickSeconds} onChange={(event) => change({ ...value, liveSettings: { ...value.liveSettings, pickSeconds: Number(event.target.value) } })}>
            {[...new Set([...PICK_SECONDS_OPTIONS, value.liveSettings.pickSeconds])].sort((a, b) => a - b).map((seconds) => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold">Clock expiry
          <select className="form-input mt-1 min-h-11 w-full" value={value.liveSettings.timeoutBehavior} onChange={(event) => change({ ...value, liveSettings: { ...value.liveSettings, timeoutBehavior: event.target.value as PickTimeoutBehavior } })}>
            {(['alert', 'auto_skip', 'none'] as const).map((behavior) => <option key={behavior} value={behavior}>{TIMEOUT_BEHAVIOR_LABELS[behavior]}</option>)}
          </select>
        </label>
        {LIVE_TOGGLES.map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-3 text-xs"><input type="checkbox" checked={value.liveSettings[key]} onChange={(event) => change({ ...value, liveSettings: { ...value.liveSettings, [key]: event.target.checked } })} />{label}</label>)}
      </div>
    </details>}
  </fieldset>;
}

export function CommissionerPlanner(props: CommissionerPlannerProps) {
  const { user } = useAuth();
  return <PlannerSession key={JSON.stringify([user?.id, props.clubId, props.seasonId])} {...props} />;
}

function PlannerSession({ clubId, seasonId, data, mutate, busy = false, readOnly = false, recipients = [] }: CommissionerPlannerProps) {
  const { palette } = useDraftArenaPalette();
  const [view, setView] = useState<'schedule' | 'presets'>('schedule');
  const rootRef = useRef<HTMLElement>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const editorSection = editor ? `${editor.kind}:${editor.original?.id ?? 'new'}` : 'list';
  useLayoutEffect(() => {
    const pane = rootRef.current?.closest<HTMLElement>('.da-commissioner-pane');
    if (pane) pane.scrollTop = 0;
  }, [editorSection, view]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef(false);
  const active = useRef(true);
  const intent = useRef<{ fingerprint: string; requestId: string } | null>(null);
  useLayoutEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const disabled = busy || working || readOnly;
  const setDraft = (next: Editor) => { setEditor(next); setError(''); setNotice(''); };
  const cancel = () => { setEditor(null); setError(''); intent.current = null; };
  const run = async (action: CommissionerAction, payload: Record<string, unknown>, reason: string) => {
    if (pending.current || busy || readOnly || !seasonId || !clubId) return null;
    if (reason.trim().length < 3) { setError('Add a reason of at least 3 characters.'); return null; }
    const fingerprint = JSON.stringify([action, payload, reason.trim()]);
    if (intent.current?.fingerprint !== fingerprint) intent.current = { fingerprint, requestId: crypto.randomUUID() };
    pending.current = true;
    setWorking(true); setError(''); setNotice('');
    try {
      const result = await mutate(action, payload, reason.trim(), intent.current.requestId);
      if (!active.current) return null;
      if (action === 'send_reminder' && typeof result.record?.notification_id !== 'string') throw new Error('The reminder did not return a delivery receipt. Refresh before retrying.');
      intent.current = null;
      return result;
    } catch (failure) {
      if (active.current) setError(failure instanceof Error ? failure.message : 'The change could not be saved. Try again.');
      return null;
    } finally {
      pending.current = false;
      if (active.current) setWorking(false);
    }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    try {
      if (editor.kind === 'plan') {
        const scheduled = timestamp(editor.scheduled), due = timestamp(editor.due);
        if (!editor.topic.trim()) throw new Error('Add a topic for this planned draft.');
        if (scheduled && due && new Date(due).getTime() < new Date(scheduled).getTime()) throw new Error('The deadline must be after the scheduled start.');
        const result = await run('upsert_plan', {
          ...(editor.original ? { id: editor.original.id, expected_version: editor.original.version } : {}),
          topic: editor.topic.trim(), notes: editor.notes.trim(), ai_context: editor.aiContext.trim(), num_rounds: editor.numRounds,
          is_live: editor.isLive, live_settings: editor.liveSettings, scheduled_at: scheduled, due_at: due,
          status: editor.status, draft_id: editor.draftId, preset_id: editor.presetId,
        }, editor.reason);
        if (result && active.current) { setEditor(null); setNotice('Planned draft saved.'); }
      } else {
        if (!editor.name.trim()) throw new Error('Give this preset a name.');
        const result = await run('upsert_preset', {
          ...(editor.original ? { id: editor.original.id, expected_version: editor.original.version } : {}),
          name: editor.name.trim(), config: {
            ...(editor.original?.config.category ? { category: editor.original.config.category } : {}),
            ...(editor.topic.trim() ? { topic: editor.topic.trim() } : {}), ...(editor.description.trim() ? { description: editor.description.trim() } : {}),
            num_rounds: editor.numRounds, ai_context: editor.aiContext.trim(), is_live: editor.isLive, live_settings: editor.liveSettings,
          },
        }, editor.reason);
        if (result && active.current) { setEditor(null); setNotice('Preset saved.'); }
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Check the planned draft details.'); }
  };
  const confirm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!prompt || (prompt.kind === 'send_reminder' && !prompt.recipient)) return;
    const result = await run(prompt.kind, prompt.kind === 'send_reminder'
      ? { kind: 'plan', plan_id: prompt.id, target_user_id: prompt.recipient }
      : { id: prompt.id, expected_version: prompt.version }, prompt.reason);
    if (result && active.current) { setPrompt(null); setNotice(prompt.kind === 'send_reminder' ? 'In-app reminder delivered.' : prompt.kind === 'delete_plan' ? 'Planned draft deleted.' : 'Preset deleted.'); }
  };
  const recentReminder = prompt?.kind === 'send_reminder' && data?.reminders.some((reminder) => reminder.kind === 'plan' && reminder.plan_id === prompt.id && reminder.target_user_id === prompt.recipient && new Date(reminder.created_at).getTime() > Date.now() - 3600000);
  if (!seasonId || !data) return <p className="text-xs text-muted-foreground">Choose a season to plan drafts and save setups.</p>;

  return <section ref={rootRef} className="da-commissioner-planner space-y-3" aria-label="Draft planning">
    <div className="da-planner-tabs flex gap-2" role="tablist" aria-label="Planning views">
      {(['schedule', 'presets'] as const).map((tab) => <button key={tab} type="button" role="tab" id={`da-planner-${tab}`} aria-controls="da-planner-panel" aria-selected={view === tab} tabIndex={view === tab ? 0 : -1} disabled={working || (!!editor && view !== tab)} className={`min-h-11 flex-1 rounded-xl border px-3 text-xs font-extrabold ${view === tab ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`} onClick={() => { setView(tab); setError(''); setNotice(''); }} onKeyDown={(event) => {
        if (editor || working || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'schedule' : event.key === 'End' ? 'presets' : view === 'schedule' ? 'presets' : 'schedule';
        setView(next); document.getElementById(`da-planner-${next}`)?.focus();
      }}>{tab === 'schedule' ? 'Schedule' : 'Presets'}</button>)}
    </div>
    <div id="da-planner-panel" role="tabpanel" aria-labelledby={`da-planner-${view}`} className="space-y-3">
    {readOnly && <p className="text-xs text-muted-foreground">This archived season is read-only.</p>}
    {notice && <p className="da-planner-notice text-xs text-primary" role="status">{notice}</p>}
    {error && !prompt && <p className="text-xs text-destructive" role="alert">{error}</p>}
    {editor && ((view === 'schedule' && editor.kind === 'plan') || (view === 'presets' && editor.kind === 'preset')) ? <form className="da-planner-editor space-y-3" onSubmit={(event) => void save(event)} aria-label={editor.kind === 'plan' ? 'Planned draft details' : 'Preset details'}>
      <h3 className="dl-display text-lg font-bold">{editor.original ? 'Edit' : 'New'} {editor.kind === 'plan' ? 'planned draft' : 'preset'}</h3>
      <fieldset disabled={disabled} className="space-y-3">
        {editor.kind === 'preset' && <label className="block text-xs font-bold">Preset name<Input className="mt-1 min-h-11" maxLength={80} required value={editor.name} onChange={(event) => setDraft({ ...editor, name: event.target.value })} /></label>}
        <label className="block text-xs font-bold">{editor.kind === 'plan' ? 'Planned topic' : 'Default topic (optional)'}<Input className="mt-1 min-h-11" maxLength={editor.kind === 'plan' ? 500 : 100} required={editor.kind === 'plan'} value={editor.topic} onChange={(event) => setDraft({ ...editor, topic: event.target.value })} /></label>
        {editor.kind === 'plan' ? <>
          <div className="da-planner-dates grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold">Scheduled start<Input className="mt-1 min-h-11" type="datetime-local" value={editor.scheduled} onChange={(event) => setDraft({ ...editor, scheduled: event.target.value })} /></label>
            <label className="block text-xs font-bold">Deadline (optional)<Input className="mt-1 min-h-11" type="datetime-local" value={editor.due} onChange={(event) => setDraft({ ...editor, due: event.target.value })} /></label>
          </div>
          <p className="text-[11px] text-muted-foreground">Dates use your device's local time. Saving a plan does not start a draft or schedule notifications.</p>
          <label className="block text-xs font-bold">Planning notes<Textarea className="mt-1 resize-none" rows={2} maxLength={2000} value={editor.notes} onChange={(event) => setDraft({ ...editor, notes: event.target.value })} /></label>
          <label className="block text-xs font-bold">Linked season draft<select className="form-input mt-1 min-h-11 w-full" value={editor.draftId ?? ''} onChange={(event) => {
            const linked = data.drafts?.find((draft) => draft.id === event.target.value);
            setDraft({ ...editor, draftId: event.target.value || null, status: !event.target.value && editor.status === 'launched' ? 'ready' : editor.status, ...(linked ? { isLive: linked.is_live } : {}) });
          }}><option value="">Not linked yet</option>{editor.draftId && !data.drafts?.some((draft) => draft.id === editor.draftId) && <option value={editor.draftId}>Current linked draft</option>}{data.drafts?.map((draft) => <option key={draft.id} value={draft.id}>{draft.topic} · {draft.status}</option>)}</select></label>
          <p className="text-[11px] text-muted-foreground">Link an existing season draft after creating it. This does not start it or change its rules.</p>
          <label className="block text-xs font-bold">Plan status<select className="form-input mt-1 min-h-11 w-full" value={editor.status} onChange={(event) => setDraft({ ...editor, status: event.target.value as CommissionerPlan['status'] })}>
            <option value="planned">Planned</option><option value="ready">Ready</option><option value="cancelled">Cancelled</option>{editor.draftId && <option value="launched">Linked to a created draft</option>}
          </select></label>
        </> : <label className="block text-xs font-bold">Default description (optional)<Textarea className="mt-1 resize-none" rows={2} maxLength={200} value={editor.description} onChange={(event) => setDraft({ ...editor, description: event.target.value })} /></label>}
        <PlannerRules value={editor} disabled={disabled} change={(next) => setDraft({ ...editor, ...next })} />
        <label className="block text-xs font-bold">Reason for change<Textarea className="mt-1 resize-none" rows={2} required minLength={3} maxLength={1000} value={editor.reason} onChange={(event) => setDraft({ ...editor, reason: event.target.value })} /></label>
      </fieldset>
      <div className="da-planner-actions flex gap-2"><Button type="button" variant="outline" className="min-h-11" disabled={working} onClick={cancel}>Cancel editing</Button><Button type="submit" className="min-h-11 flex-1" disabled={disabled || editor.reason.trim().length < 3}><Save className="mr-2 h-4 w-4" />{working ? 'Saving…' : editor.kind === 'plan' ? 'Save planned draft' : 'Save preset'}</Button></div>
    </form> : <>
      <div className="flex items-center justify-between gap-3"><div><h3 className="dl-display text-lg font-bold">{view === 'schedule' ? 'Upcoming drafts' : 'Saved setups'}</h3><p className="text-[11px] text-muted-foreground">{view === 'schedule' ? 'Plan the date and topic. Send reminders explicitly when needed.' : 'Reusable rounds, judging instructions and LIVE stage settings.'}</p></div><Button type="button" className="min-h-11 shrink-0" disabled={disabled} onClick={() => { setDraft(view === 'schedule' ? newPlan() : presetEditor()); intent.current = null; }}><Plus className="mr-1 h-4 w-4" />{view === 'schedule' ? 'New plan' : 'New preset'}</Button></div>
      {view === 'schedule' && !recipients.length && <p className="text-[11px] text-muted-foreground">Reminders become available when the season has draft participants.</p>}
      <div className="da-planner-list space-y-2">
        {view === 'schedule' ? data.plans.length ? data.plans.map((plan) => <article className="da-planner-item rounded-xl border border-border p-3" key={plan.id}>
          <div className="flex items-start justify-between gap-2"><h4 className="break-words text-sm font-extrabold">{plan.topic}</h4><span className="shrink-0 text-[10px] font-bold uppercase text-muted-foreground">{plan.status === 'launched' ? 'Linked' : plan.status}</span></div>
          <p className="mt-1 text-[11px] text-muted-foreground"><CalendarDays className="mr-1 inline h-3 w-3" />{displayDate(plan.scheduled_at)} · {plan.num_rounds} rounds{plan.is_live ? ' · LIVE' : ''}</p>
          {plan.due_at && <p className="text-[11px] text-muted-foreground">Deadline {displayDate(plan.due_at)}</p>}
          {plan.notes && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">{plan.notes}</p>}
          <div className="da-planner-item-actions mt-2 flex flex-wrap gap-2">
            {['planned', 'ready'].includes(plan.status) && <Link className="inline-flex min-h-11 items-center rounded-lg border border-primary px-3 text-xs font-bold text-primary" to={`${plan.is_live ? '/drafts/live/create' : '/drafts/create'}?${new URLSearchParams({ plan: plan.id, season: plan.season_id })}`}>Use in draft</Link>}
            <Button type="button" variant="outline" className="min-h-11" disabled={disabled} aria-label={`Edit plan ${plan.topic}`} onClick={() => setDraft(planEditor(plan))}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>
            <Button type="button" variant="outline" className="min-h-11" disabled={disabled || !recipients.length || !['planned', 'ready'].includes(plan.status)} aria-label={`Remind participants about ${plan.topic}`} onClick={() => { setPrompt({ kind: 'send_reminder', id: plan.id, version: plan.version, title: plan.topic, reason: '', recipient: '' }); setError(''); }}><Bell className="mr-1 h-3.5 w-3.5" />Remind</Button>
            {plan.draft_id && <Link className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-xs font-bold" to={`${plan.is_live ? '/drafts/live/' : '/drafts/'}${plan.draft_id}`}>Open draft</Link>}
            <Button type="button" variant="ghost" className="min-h-11" disabled={disabled} aria-label={`Delete plan ${plan.topic}`} onClick={() => { setPrompt({ kind: 'delete_plan', id: plan.id, version: plan.version, title: plan.topic, reason: '', recipient: '' }); setError(''); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </article>) : <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">No drafts planned for this season yet.</p> : data.presets.length ? data.presets.map((preset) => <article className="da-planner-item rounded-xl border border-border p-3" key={preset.id}>
          <h4 className="break-words text-sm font-extrabold">{preset.name}</h4><p className="mt-1 text-[11px] text-muted-foreground">{preset.config.num_rounds ?? 5} rounds · {preset.config.is_live ? 'LIVE event' : 'Standard draft'}{preset.config.ai_context ? ' · Judging instructions included' : ''}</p>
          <div className="da-planner-item-actions mt-2 flex flex-wrap gap-2">
            <Link className="inline-flex min-h-11 items-center rounded-lg border border-primary px-3 text-xs font-bold text-primary" to={`${preset.config.is_live ? '/drafts/live/create' : '/drafts/create'}?${new URLSearchParams({ preset: preset.id, season: preset.season_id })}`}><Copy className="mr-1 h-3.5 w-3.5" />Use in draft</Link>
            <Button type="button" variant="outline" className="min-h-11" disabled={disabled} onClick={() => { setView('schedule'); setDraft(newPlan(preset)); }}>Plan draft</Button>
            <Button type="button" variant="outline" className="min-h-11" disabled={disabled} aria-label={`Edit preset ${preset.name}`} onClick={() => setDraft(presetEditor(preset))}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>
            <Button type="button" variant="ghost" className="min-h-11" disabled={disabled} aria-label={`Delete preset ${preset.name}`} onClick={() => { setPrompt({ kind: 'delete_preset', id: preset.id, version: preset.version, title: preset.name, reason: '', recipient: '' }); setError(''); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </article>) : <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">No saved setups for this season yet.</p>}
      </div>
    </>}
    </div>
    <Dialog open={!!prompt} onOpenChange={(open) => { if (!open && !working) { setPrompt(null); setError(''); intent.current = null; } }}>
      <DialogContent className="da-appearance-panel da-lounge da-arena-dialog da-planner-dialog da-form-dialog" data-da-palette={palette}>
        <DialogHeader className="da-form-dialog-header"><DialogTitle>{prompt?.kind === 'send_reminder' ? 'Send plan reminder' : prompt?.kind === 'delete_plan' ? 'Delete planned draft' : 'Delete preset'}</DialogTitle></DialogHeader>
        {prompt && <form className="da-form-dialog-form" onSubmit={(event) => void confirm(event)} aria-label="Plan confirmation">
          <div className="da-form-dialog-body space-y-3" role="region" aria-label="Plan confirmation details">
            <DialogDescription className="break-words">{prompt.title}</DialogDescription>
            {prompt.kind === 'send_reminder' && <>
              <p className="text-xs text-muted-foreground">Sends an in-app notification now. Your reason is the message in their inbox. Automatic reminders are not scheduled.</p>
              <label className="block text-xs font-bold">Recipient<select className="form-input mt-1 min-h-11 w-full" required disabled={working} value={prompt.recipient} onChange={(event) => setPrompt({ ...prompt, recipient: event.target.value })}><option value="">Choose a participant</option>{recipients.map((person) => <option key={person.userId} value={person.userId}>{person.name}</option>)}</select></label>
              {recentReminder && <p className="text-xs text-muted-foreground">This participant was reminded within the past hour. Wait before sending another.</p>}
            </>}
            {prompt.kind !== 'send_reminder' && <p className="text-xs text-muted-foreground">This removes the saved {prompt.kind === 'delete_plan' ? 'plan' : 'setup'}. Existing drafts and results stay intact.</p>}
            <label className="block text-xs font-bold">{prompt.kind === 'send_reminder' ? 'Reminder reason' : 'Reason for deletion'}<Textarea className="mt-1 resize-none" rows={3} minLength={3} maxLength={1000} required disabled={working} value={prompt.reason} onChange={(event) => setPrompt({ ...prompt, reason: event.target.value })} /></label>
            {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
          </div>
          <div className="da-planner-actions da-form-dialog-actions flex gap-2"><Button type="button" variant="outline" className="min-h-11" disabled={working} onClick={() => { setPrompt(null); setError(''); intent.current = null; }}>Cancel</Button><Button type="submit" className="min-h-11 flex-1" disabled={disabled || prompt.reason.trim().length < 3 || (prompt.kind === 'send_reminder' && (!prompt.recipient || !!recentReminder))}>{working ? 'Saving…' : prompt.kind === 'send_reminder' ? 'Send in-app reminder' : prompt.kind === 'delete_plan' ? 'Delete planned draft' : 'Delete preset'}</Button></div>
        </form>}
      </DialogContent>
    </Dialog>
  </section>;
}
