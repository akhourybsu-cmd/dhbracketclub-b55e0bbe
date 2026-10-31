import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { DaInfoRow } from '@/components/draft/ui/DraftKit';

const STEPS = ['Basics', 'Judging', 'Format', 'Review'] as const;
const LIVE_STEPS = ['Topic', 'Rules', 'Stage', 'Review'] as const;
import { Bookmark, ArrowLeft, Sparkles, Radio, MonitorPlay } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';
import { fetchCommissionerPlan, fetchCommissionerPresets, type CommissionerPlan, type CommissionerPreset, type CommissionerPresetConfig } from '@/lib/draft/commissioner';
import {
  DEFAULT_LIVE_SETTINGS,
  PICK_SECONDS_OPTIONS,
  TIMEOUT_BEHAVIOR_HINTS,
  TIMEOUT_BEHAVIOR_LABELS,
  newKioskCode,
  parseLiveSettings,
  type LiveDraftSettings,
  type PickTimeoutBehavior,
} from '@/lib/draft/liveDraft';

export default function CreateDraftPage() {
  const { user } = useAuth();
  const { club } = useClub();
  const navigate = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();
  const dedicatedLive = location.pathname.replace(/\/+$/, '') === '/drafts/live/create';
  const { enabled: liveEnabled, loading: liveFlagLoading } = useFeatureFlag('live-draft');
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [aiContext, setAiContext] = useState('');
  const [numRounds, setNumRounds] = useState(5);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [pickSeconds, setPickSeconds] = useState(DEFAULT_LIVE_SETTINGS.pickSeconds);
  const [timeoutBehavior, setTimeoutBehavior] = useState<PickTimeoutBehavior>(DEFAULT_LIVE_SETTINGS.timeoutBehavior);
  const [announce, setAnnounce] = useState(true);
  const [ticker, setTicker] = useState(true);
  const [kioskSoundOn, setKioskSoundOn] = useState(true);
  const [ceremony, setCeremony] = useState(true);
  const [broadcast, setBroadcast] = useState(true);
  const [stagePanel, setStagePanel] = useState<'clock' | 'presentation'>('clock');
  const [selectedPreset, setSelectedPreset] = useState(() => search.get('preset') ?? '');
  const [appliedPreset, setAppliedPreset] = useState('');
  const [appliedPlan, setAppliedPlan] = useState('');
  const [presetLiveSettings, setPresetLiveSettings] = useState<LiveDraftSettings | null>(null);
  const [presetReload, setPresetReload] = useState(0);
  const [presetError, setPresetError] = useState('');
  const presetSeason = search.get('season');
  const requestedPlan = search.get('plan');
  const presetScope = JSON.stringify([user?.id, club?.id, presetSeason]);
  const currentPresetScope = useRef(presetScope);
  currentPresetScope.current = presetScope;
  const [presetSnapshot, setPresetSnapshot] = useState<{ scope: string; rows: CommissionerPreset[]; loading: boolean; error: string }>({ scope: presetScope, rows: [], loading: !!club?.id && !!user?.id, error: '' });
  useEffect(() => {
    if (!club?.id || !user?.id) return;
    let active = true;
    setPresetSnapshot({ scope: presetScope, rows: [], loading: true, error: '' });
    void fetchCommissionerPresets(club.id, presetSeason).then((rows) => {
      if (active && currentPresetScope.current === presetScope) setPresetSnapshot({ scope: presetScope, rows, loading: false, error: '' });
    }).catch((failure) => {
      if (active && currentPresetScope.current === presetScope) setPresetSnapshot({ scope: presetScope, rows: [], loading: false, error: failure instanceof Error ? failure.message : 'Saved setups could not be loaded.' });
    });
    return () => { active = false; };
  }, [club?.id, user?.id, presetSeason, presetScope, presetReload]);
  const savedPresets = presetSnapshot.scope === presetScope ? presetSnapshot.rows : [];
  const availablePresets = savedPresets.filter((preset) => !dedicatedLive || preset.config.is_live);
  const chosenPreset = availablePresets.find((preset) => preset.id === selectedPreset);
  const presetsLoading = !!club?.id && (presetSnapshot.scope !== presetScope || presetSnapshot.loading);
  const [planReload, setPlanReload] = useState(0);
  const planScope = JSON.stringify([presetScope, requestedPlan]);
  const currentPlanScope = useRef(planScope);
  currentPlanScope.current = planScope;
  const [planSnapshot, setPlanSnapshot] = useState<{ scope: string; row: CommissionerPlan | null; loading: boolean; error: string }>({ scope: planScope, row: null, loading: !!requestedPlan, error: '' });
  useEffect(() => {
    if (!requestedPlan || !club?.id || !user?.id) return;
    if (!presetSeason) { setPlanSnapshot({ scope: planScope, row: null, loading: false, error: 'This planned draft link needs a season. Open it from Planner again.' }); return; }
    let active = true;
    setPlanSnapshot({ scope: planScope, row: null, loading: true, error: '' });
    void fetchCommissionerPlan(club.id, presetSeason, requestedPlan).then((row) => {
      if (active && currentPlanScope.current === planScope) setPlanSnapshot({ scope: planScope, row, loading: false, error: row ? '' : 'This planned draft is unavailable. Continue manually or return to Planner.' });
    }).catch((failure) => {
      if (active && currentPlanScope.current === planScope) setPlanSnapshot({ scope: planScope, row: null, loading: false, error: failure instanceof Error ? failure.message : 'The planned draft could not be loaded.' });
    });
    return () => { active = false; };
  }, [club?.id, user?.id, requestedPlan, presetSeason, planScope, planReload]);
  const chosenPlan = planSnapshot.scope === planScope ? planSnapshot.row : null;
  const planLoading = !!requestedPlan && (planSnapshot.scope !== planScope || planSnapshot.loading);
  const applySetup = (config: Partial<CommissionerPresetConfig>, name: string, fromPlan = false) => {
    const rounds = Number(config.num_rounds ?? 5), instructions = config.ai_context ?? '', live = config.is_live ?? false;
    if (dedicatedLive && !live) { setPresetError('This saved setup is for a standard draft. Choose a LIVE setup for this event.'); return; }
    if (live && (liveFlagLoading || !liveEnabled)) { setPresetError('LIVE access is required to apply this saved setup.'); return; }
    if (!Number.isInteger(rounds) || rounds < 1 || rounds > 20 || typeof instructions !== 'string' || instructions.length > 1000 || typeof live !== 'boolean') { setPresetError('This saved setup has invalid rounds or judging instructions.'); return; }
    if ((config.topic != null && typeof config.topic !== 'string') || (config.description != null && typeof config.description !== 'string')) { setPresetError('This saved setup has an invalid topic or description.'); return; }
    if ((!topic.trim() && (config.topic?.length ?? 0) > 100) || (!description.trim() && (config.description?.length ?? 0) > 200)) { setPresetError('Enter a topic under 100 characters and a description under 200 characters before applying this setup.'); return; }
    const settings = parseLiveSettings(config.live_settings);
    setNumRounds(rounds);
    setAiContext(instructions);
    setIsLive(live);
    setPresetLiveSettings(settings);
    setPickSeconds(settings.pickSeconds);
    setTimeoutBehavior(settings.timeoutBehavior);
    setAnnounce(settings.announce); setTicker(settings.ticker); setKioskSoundOn(settings.sound);
    setCeremony(settings.ceremony); setBroadcast(settings.broadcast);
    if (!topic.trim() && config.topic) setTopic(config.topic);
    if (!description.trim() && config.description) setDescription(config.description);
    setAppliedPreset(name);
    setAppliedPlan(fromPlan ? name : '');
    setPresetError('');
  };
  const applyPreset = () => { if (chosenPreset) applySetup(chosenPreset.config, chosenPreset.name); };
  const creating = useRef(false);
  const steps = dedicatedLive ? LIVE_STEPS : STEPS;
  const wantsLive = dedicatedLive || isLive;
  const liveUnavailable = liveFlagLoading || !liveEnabled;
  const submitDisabled = loading || !topic.trim() || (step === steps.length - 1 && wantsLive && liveUnavailable);
  const presentationChoices: [string, boolean, (value: boolean) => void][] = [
    ['Announce each pick on the big screen', announce, setAnnounce],
    ['Ticker tape of recent picks', ticker, setTicker],
    ['Projector sound effects', kioskSoundOn, setKioskSoundOn],
    ['Pre-draft order ceremony', ceremony, setCeremony],
    ['Broadcast moments and milestones', broadcast, setBroadcast],
  ];
  const roundsControl = (
    <div className={dedicatedLive ? 'da-live-rules-rounds' : undefined}>
      <p className="form-label flex items-baseline justify-between">
        <span>Rounds</span>
        <span className="text-[10px] font-semibold normal-case tracking-normal text-muted-foreground/70">{numRounds} picks each</span>
      </p>
      <div className="flex gap-2" role="group" aria-label="Rounds">
        {[...new Set([3, 5, 7, 10, numRounds])].sort((a, b) => a - b).map(n => (
          <button key={n} type="button" onClick={() => setNumRounds(n)} aria-pressed={numRounds === n}
            className={`flex-1 min-h-11 py-2.5 rounded-lg text-xs font-bold transition-all btn-press ${numRounds === n ? 'shadow-md' : 'text-muted-foreground'}`}
            style={numRounds === n
              ? { background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', boxShadow: 'inset 0 1px 0 hsl(var(--foreground) / 0.12)' }
              : { background: 'hsl(var(--muted) / 0.6)', border: '1px solid hsl(var(--gold) / 0.18)' }}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !topic.trim() || creating.current || (wantsLive && liveUnavailable)) return;

    creating.current = true;
    setLoading(true);
    try {
      // Create competition
      const { data: comp, error: compErr } = await supabase
        .from('competitions')
        .insert({
          type: 'draft',
          title: topic.trim(),
          description: description.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();
      if (compErr) throw compErr;

      // Create draft — creator is first participant
      const trimmedCtx = aiContext.trim();
      const { data: draft, error: draftErr } = await supabase
        .from('drafts')
        .insert({
          competition_id: comp.id,
          topic: topic.trim(),
          created_by: user.id,
          num_rounds: numRounds,
          status: 'setup',
          ai_context: trimmedCtx ? trimmedCtx : null,
          ...(liveEnabled && wantsLive
            ? {
                is_live: true,
                kiosk_code: newKioskCode(),
                timer_seconds: pickSeconds,
                live_settings: {
                  ...(presetLiveSettings ?? DEFAULT_LIVE_SETTINGS),
                  pickSeconds,
                  timeoutBehavior,
                  announce,
                  ticker,
                  sound: kioskSoundOn,
                  ceremony,
                  broadcast,
                },
                ceremony_enabled: ceremony,
              }
            : {}),
        })
        .select()
        .single();
      if (draftErr) throw draftErr;

      // Add creator as first participant
      const { error: partErr } = await supabase.from('draft_participants').insert({
        draft_id: draft.id,
        user_id: user.id,
        pick_order: 1,
      });
      if (partErr) throw partErr;

      // Activity feed
      await supabase.from('activity_feed').insert({
        actor_user_id: user.id,
        event_type: 'draft_created',
        target_type: 'draft',
        target_id: draft.id,
        metadata: { topic: topic.trim() },
      });

      toast.success(dedicatedLive ? 'Live event created!' : 'Draft created!');
      navigate(dedicatedLive ? `/drafts/live/${draft.id}` : `/drafts/${draft.id}`);
    } catch (err: unknown) {
      toast.error(err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' ? err.message : 'Failed to create draft');
    } finally {
      creating.current = false;
      setLoading(false);
    }
  };

  return (
    <div className={`max-w-xl mx-auto pb-6 da-ledger-page da-create-page${dedicatedLive ? ' da-live-create' : ''}`} data-create-step={step + 1} data-create-mode={dedicatedLive ? 'live' : 'standard'}>
      <div className="flex items-center gap-2 mb-4 da-create-header">
        <Link to={dedicatedLive ? '/drafts/live' : '/drafts'} className="da-back" aria-label={dedicatedLive ? 'Back to LIVE Arena' : 'Back to Drafts'}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`page-header mb-0 flex-1${dedicatedLive ? ' da-live-create-brand' : ''}`}
        >
          <div className="da-page-icon">
            {dedicatedLive ? <Radio className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
          </div>
          <div>
            <h1 className="page-header-title dl-display">{dedicatedLive ? 'Draft Arena LIVE' : 'Create Draft'}</h1>
            <p className="page-header-subtitle">{dedicatedLive ? 'Host a live event' : 'Set up a snake draft for the crew'}</p>
          </div>
          {dedicatedLive && <span className="da-live-badge" aria-label="LIVE event"><Radio className="h-3 w-3" aria-hidden="true" />LIVE</span>}
        </motion.div>
      </div>

      <motion.form aria-label={dedicatedLive ? 'Create live event' : 'Create draft'} onSubmit={(e) => { if (step < steps.length - 1) { e.preventDefault(); if (topic.trim()) setStep(step + 1); return; } void handleCreate(e); }} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : 0.05 }} className="space-y-5 da-create-form">
        <ol className="flex items-center gap-1.5 da-create-steps" aria-label="Steps">
          {steps.map((label, i) => (
            <li key={label} className="flex-1">
              <button type="button" disabled={i > 0 && !topic.trim()} onClick={() => setStep(i)}
                className="w-full text-left min-h-[44px] disabled:opacity-50" aria-current={i === step ? 'step' : undefined}>
                <span className="block h-1 rounded-full overflow-hidden bg-muted">
                  <motion.span className="block h-full bg-[hsl(var(--da-gold))]" initial={false} animate={{ width: i <= step ? '100%' : '0%' }} transition={{ duration: 0.3 }} />
                </span>
                <span className={`mt-1.5 block text-[10px] font-extrabold uppercase tracking-wider ${i === step ? 'text-[hsl(var(--da-gold))]' : 'text-muted-foreground'}`}>{label}</span>
              </button>
            </li>
          ))}
        </ol>
        <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} initial={reduce ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: -12 }} transition={{ duration: reduce ? 0 : 0.2 }}
          className="da-glass da-ledger-section p-5 space-y-5 da-create-stage" aria-label={`${steps[step]} setup`}>
          {step === 0 && (<>
          {club?.id && requestedPlan && <section className="da-creator-plan space-y-2 rounded-xl border border-border p-3" aria-label="Planned draft setup">
            <p className="text-[11px] font-bold">Planned draft</p>
            {planLoading ? <p className="text-xs text-muted-foreground" role="status">Loading planned draft…</p> : chosenPlan ? <>
              <p className="break-words text-xs font-bold">{chosenPlan.topic}</p>
              <p className="text-[10px] text-muted-foreground">{chosenPlan.num_rounds} rounds · {chosenPlan.is_live ? 'LIVE event' : 'Standard draft'}</p>
              <Button type="button" className="min-h-11" disabled={loading || (chosenPlan.is_live && liveUnavailable)} onClick={() => applySetup({ topic: chosenPlan.topic, num_rounds: chosenPlan.num_rounds, ai_context: chosenPlan.ai_context, is_live: chosenPlan.is_live, live_settings: chosenPlan.live_settings }, chosenPlan.topic, true)}>Apply planned draft</Button>
              <p className="text-[10px] leading-snug text-muted-foreground">Your entered topic and description are kept. Create first, add it to the intended season, then link it in Planner.</p>
            </> : null}
            {planSnapshot.error && <p className="text-[11px] text-destructive" role="alert">{planSnapshot.error}</p>}
            {planSnapshot.error && <Button type="button" variant="outline" className="min-h-11" onClick={() => setPlanReload((value) => value + 1)}>Retry planned draft</Button>}
          </section>}
          {club?.id && (presetsLoading || savedPresets.length > 0 || presetSnapshot.error || selectedPreset) && <section className="da-creator-presets space-y-2 rounded-xl border border-border p-3" aria-label="Saved draft setups">
            <label className="block text-[11px] font-bold" htmlFor="draft-saved-preset">Saved setup</label>
            {presetsLoading ? <p className="text-xs text-muted-foreground" role="status">Loading saved setups…</p> : <div className="flex gap-2">
              <select id="draft-saved-preset" className="form-input min-h-11 min-w-0 flex-1" value={selectedPreset} onChange={(event) => { setSelectedPreset(event.target.value); setPresetError(''); }}>
                <option value="">Choose a saved setup</option>
                {selectedPreset && !chosenPreset && <option value={selectedPreset} disabled>Unavailable in this setup</option>}
                {availablePresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name} · {preset.config.num_rounds ?? 5} rounds{preset.config.is_live ? ' · LIVE' : ''}</option>)}
              </select>
              <Button type="button" className="min-h-11 shrink-0" disabled={!chosenPreset || loading || (!!chosenPreset?.config.is_live && liveUnavailable)} onClick={applyPreset}>Apply saved preset</Button>
            </div>}
            <p className="text-[10px] leading-snug text-muted-foreground">Apply replaces rounds, judging instructions and stage settings. Your entered topic and description are kept.</p>
            {appliedPreset && <p className="text-[11px] font-bold text-primary" role="status">Started from {appliedPreset} · settings stay editable</p>}
            {!presetsLoading && selectedPreset && !chosenPreset && !presetSnapshot.error && <p className="text-[11px] text-muted-foreground">This saved setup is unavailable for this draft mode. Choose another or continue manually.</p>}
            {presetSnapshot.error && <p className="text-[11px] text-destructive" role="alert">{presetSnapshot.error}</p>}
            {presetSnapshot.error && <Button type="button" variant="outline" className="min-h-11" onClick={() => setPresetReload((value) => value + 1)}>Retry saved setups</Button>}
          </section>}
          {presetError && <p className="text-[11px] text-destructive" role="alert">{presetError}</p>}
          <div>
            <label className="form-label" htmlFor="draft-topic">Topic</label>
            <Input
              id="draft-topic"
              required
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Best Fast Food Items"
              maxLength={100}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="draft-description">Description <span className="normal-case font-normal tracking-normal">(optional)</span></label>
            <Input
              id="draft-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What are we drafting?"
              maxLength={200}
              className="form-input"
            />
          </div>
          </>)}
          {step === 1 && (<>
          {dedicatedLive && roundsControl}
          {/* AI Judging Context — elevated into a gold "smart-assist" panel so
              it reads as the field that steers how the AI report judges picks,
              distinct from the plain topic/description inputs. */}
          <div
            className="rounded-xl p-3.5 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.07), transparent 72%)', border: '1px solid hsl(var(--gold) / 0.2)' }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-md" style={{ background: 'hsl(var(--gold) / 0.16)' }}>
                <Sparkles className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />
              </span>
              <label htmlFor="draft-judging-context" className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: 'hsl(var(--gold))' }}>AI Judging Context</label>
              <span className="text-[10px] font-medium text-muted-foreground/60 normal-case tracking-normal">optional</span>
            </div>
            <Textarea
              id="draft-judging-context"
              value={aiContext}
              onChange={e => setAiContext(e.target.value)}
              placeholder={'e.g. "Best Villains of All Time — include movies, TV, video games, comics, anime, books, and mythology. Don\u2019t limit to movie villains."'}
              maxLength={1000}
              rows={4}
              className="form-input min-h-[96px] resize-none text-[13px] leading-snug"
            />
            <p className="text-[10px] text-muted-foreground/70 mt-1.5 leading-snug">
              Tell the AI what this category includes or excludes so the report judges picks the way you intended. {aiContext.length}/1000
            </p>
          </div>

          </>)}
          {step === 2 && dedicatedLive && (<div className="da-live-stage-settings">
            <div className="da-live-stage-tabs grid grid-cols-2 gap-2" role="tablist" aria-label="LIVE stage settings">
              {(['clock', 'presentation'] as const).map((panel) => <button
                key={panel} type="button" role="tab" id={`live-stage-${panel}`} aria-selected={stagePanel === panel}
                aria-controls="live-stage-panel" tabIndex={stagePanel === panel ? 0 : -1}
                className="min-h-11 rounded-xl border border-border px-3 text-xs font-extrabold"
                onClick={() => setStagePanel(panel)}
                onKeyDown={(event) => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                  event.preventDefault();
                  const next = event.key === 'Home' ? 'clock' : event.key === 'End' ? 'presentation' : stagePanel === 'clock' ? 'presentation' : 'clock';
                  setStagePanel(next);
                  document.getElementById(`live-stage-${next}`)?.focus();
                }}
              >{panel === 'clock' ? 'Clock' : 'Presentation'}</button>)}
            </div>
            <div id="live-stage-panel" role="tabpanel" aria-labelledby={`live-stage-${stagePanel}`} className="da-live-stage-panel">
              {stagePanel === 'clock' ? <div className="da-live-clock-settings space-y-3">
                <div>
                  <p className="form-label">Time per pick</p>
                  <div className="da-live-clock-options grid grid-cols-4 gap-1.5" role="group" aria-label="Time per pick">
                    {[...new Set([...PICK_SECONDS_OPTIONS, pickSeconds])].sort((a, b) => a - b).map((seconds) => <button key={seconds} type="button" aria-pressed={pickSeconds === seconds}
                      onClick={() => setPickSeconds(seconds)} className={`min-h-11 rounded-lg border px-2 text-xs font-bold ${pickSeconds === seconds ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}>
                      {seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60}m` : `${seconds}s`}
                    </button>)}
                  </div>
                </div>
                <div>
                  <p className="form-label">When the clock hits zero</p>
                  <div className="da-live-timeout-options grid grid-cols-3 gap-1.5" role="group" aria-label="Clock expiry">
                    {(['alert', 'auto_skip', 'none'] as PickTimeoutBehavior[]).map((behavior) => <button key={behavior} type="button" aria-pressed={timeoutBehavior === behavior}
                      onClick={() => setTimeoutBehavior(behavior)} className={`min-h-11 rounded-lg border p-2 text-[11px] font-bold leading-tight ${timeoutBehavior === behavior ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                      {TIMEOUT_BEHAVIOR_LABELS[behavior]}
                    </button>)}
                  </div>
                  <p className="da-live-timeout-hint mt-2 text-[10px] leading-snug text-muted-foreground" role="status">{TIMEOUT_BEHAVIOR_HINTS[timeoutBehavior]}</p>
                </div>
              </div> : <div className="da-live-presentation-options space-y-2">
                {presentationChoices.map(([label, value, set]) => <button key={label} type="button" aria-pressed={value} onClick={() => set(!value)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-border p-2.5 text-left">
                  <span className="text-[11px] font-semibold leading-snug">{label}</span>
                  <span className={`relative h-[22px] w-10 shrink-0 rounded-full ${value ? 'bg-primary' : 'bg-muted'}`} aria-hidden="true"><span className="absolute top-0.5 h-[18px] w-[18px] rounded-full bg-background" style={{ left: value ? 20 : 2 }} /></span>
                </button>)}
              </div>}
            </div>
          </div>)}
          {step === 2 && !dedicatedLive && (<>
          {/* Live draft hosting — host the room in person, project the board. */}
          {(liveEnabled || isLive) && (
            <div
              className="rounded-xl p-3.5"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.08), transparent 72%)',
                border: '1px solid hsl(var(--primary) / 0.28)',
              }}
            >
              <button
                type="button"
                onClick={() => setIsLive(v => !v)}
                className="w-full flex items-center gap-2.5 text-left btn-press"
              >
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: 'hsl(var(--primary) / 0.16)' }}>
                  <Radio className="w-3.5 h-3.5 text-primary" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-extrabold uppercase tracking-[0.12em] text-primary">Live draft</span>
                  <span className="block text-[11px] text-muted-foreground leading-snug">
                    Everyone picks on their own device while you run the clock and project the board.
                  </span>
                </span>
                <span className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${isLive ? 'bg-primary' : 'bg-muted'}`}>
                  <span className="absolute top-0.5 w-5 h-5 rounded-full bg-background transition-all" style={{ left: isLive ? 22 : 2 }} />
                </span>
              </button>

              {isLive && (
                <div className="mt-3.5 space-y-3.5">
                  <div>
                    <p className="form-label">Time per pick</p>
                    <div className="flex flex-wrap gap-2">
                      {[...new Set([...PICK_SECONDS_OPTIONS, pickSeconds])].sort((a, b) => a - b).map(sec => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setPickSeconds(sec)}
                          className={`px-3 h-9 rounded-lg text-[12px] font-bold tabular-nums btn-press border ${
                            pickSeconds === sec ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-border/70'
                          }`}
                        >
                          {sec >= 60 ? `${sec / 60}m` : `${sec}s`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="form-label">When the clock hits zero</p>
                    <div className="space-y-2">
                      {(['alert', 'auto_skip', 'none'] as PickTimeoutBehavior[]).map(b => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setTimeoutBehavior(b)}
                          className={`w-full text-left rounded-lg p-2.5 border btn-press ${
                            timeoutBehavior === b ? 'border-primary bg-primary/10' : 'border-border/70'
                          }`}
                        >
                          <span className="block text-[12px] font-bold">{TIMEOUT_BEHAVIOR_LABELS[b]}</span>
                          <span className="block text-[10px] text-muted-foreground leading-snug">{TIMEOUT_BEHAVIOR_HINTS[b]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {([
                      ['Announce each pick on the big screen', announce, setAnnounce],
                      ['Ticker tape of recent picks', ticker, setTicker],
                      ['Projector sound effects', kioskSoundOn, setKioskSoundOn],
                       ['Pre-draft order ceremony', ceremony, setCeremony],
                       ['Broadcast moments and milestones', broadcast, setBroadcast],
                    ] as [string, boolean, (v: boolean) => void][]).map(([label, value, set]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => set(!value)}
                        className="w-full flex items-center justify-between rounded-lg p-2.5 border border-border/70 btn-press"
                      >
                        <span className="text-[12px] font-semibold text-left">{label}</span>
                        <span className={`w-10 h-5.5 rounded-full relative transition-colors shrink-0 ${value ? 'bg-primary' : 'bg-muted'}`} style={{ height: 22 }}>
                          <span className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-background transition-all" style={{ left: value ? 20 : 2 }} />
                        </span>
                      </button>
                    ))}
                  </div>

                  <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground/80 leading-snug">
                    <MonitorPlay className="w-3.5 h-3.5 text-primary shrink-0 mt-px" />
                    A projector link and room code are created with the draft. Live drafts stay out of season standings unless you add them yourself.
                  </p>
                </div>
              )}
            </div>
          )}

          {roundsControl}
          </>)}
          {step === 3 && (
            <div className={dedicatedLive ? 'da-live-review' : undefined}>
              <p className="form-label">Review</p>
              <DaInfoRow icon={Bookmark} label="Topic" value={topic.trim() || '—'} />
              {description.trim() && <DaInfoRow icon={Bookmark} label="Description" value={description.trim()} />}
              <DaInfoRow icon={Sparkles} label="AI judging context" value={aiContext.trim() ? 'Added' : 'None'} />
              <DaInfoRow icon={Bookmark} label="Rounds" value={`${numRounds} picks each`} />
              {appliedPlan && <p className="text-[11px] leading-snug text-muted-foreground">Started from plan: {appliedPlan}. After creation, add the draft to the intended season and attach it in Planner.</p>}
              {(liveEnabled || wantsLive) && <DaInfoRow icon={Radio} label={dedicatedLive ? 'Pick clock' : 'Live draft'} value={wantsLive ? `${dedicatedLive ? '' : 'On · '}${pickSeconds}s per pick` : 'Off'} />}
              {dedicatedLive && <>
                <DaInfoRow icon={Radio} label="Clock expiry" value={TIMEOUT_BEHAVIOR_LABELS[timeoutBehavior]} />
                <div className="da-live-review-show flex flex-wrap gap-1.5" aria-label="Presentation settings">
                  {presentationChoices.map(([label, value]) => <span key={label} className="rounded-md border border-border px-2 py-1 text-[9px] text-muted-foreground" title={label}>{label.startsWith('Announce') ? 'Reveals' : label.startsWith('Ticker') ? 'Ticker' : label.startsWith('Projector') ? 'Sound' : label.startsWith('Pre-draft') ? 'Ceremony' : 'Broadcast'} · {value ? 'On' : 'Off'}</span>)}
                </div>
                <p className="da-live-create-note text-[11px] leading-snug text-muted-foreground">Create the room, invite your crew, then start when everyone is ready.</p>
              </>}
              {wantsLive && liveUnavailable && <p className="da-live-create-status text-[11px] text-muted-foreground" role="status">{liveFlagLoading ? 'Checking LIVE access…' : 'Live hosting is not available for this account.'}</p>}
            </div>
          )}
        </motion.div>
        </AnimatePresence>

        <div className="flex gap-2 da-create-actions">
        {step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)} className="h-12 px-5 rounded-lg border border-border font-bold text-[13px] btn-press">Back</button>
        )}
        <button
          type="submit"
          disabled={submitDisabled}
          className="flex-1 h-12 rounded-lg font-black uppercase tracking-[0.14em] text-[13px] btn-press transition-all disabled:cursor-not-allowed"
          style={{
             color: submitDisabled ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary-foreground))',
            background: submitDisabled
              ? 'hsl(var(--muted) / 0.6)'
               : 'hsl(var(--primary))',
            border: submitDisabled
              ? '1px solid hsl(var(--border))'
               : '1px solid hsl(var(--primary) / 0.65)',
            boxShadow: submitDisabled
              ? 'none'
               : '0 6px 18px hsl(var(--background) / 0.55), inset 0 1px 0 hsl(var(--foreground) / 0.12)',
            opacity: submitDisabled ? 0.9 : 1,
          }}
        >
          {loading ? 'Creating…' : step < steps.length - 1 ? 'Next' : dedicatedLive ? 'Create live event' : 'Create Draft'}
        </button>
        </div>
      </motion.form>
    </div>
  );
}
