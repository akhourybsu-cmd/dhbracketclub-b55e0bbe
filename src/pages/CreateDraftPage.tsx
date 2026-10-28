import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { DaInfoRow } from '@/components/draft/ui/DraftKit';

const STEPS = ['Basics', 'Judging', 'Format', 'Review'] as const;
import { Bookmark, ArrowLeft, Sparkles, Radio, MonitorPlay } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';
import {
  DEFAULT_LIVE_SETTINGS,
  PICK_SECONDS_OPTIONS,
  TIMEOUT_BEHAVIOR_HINTS,
  TIMEOUT_BEHAVIOR_LABELS,
  newKioskCode,
  type PickTimeoutBehavior,
} from '@/lib/draft/liveDraft';

export default function CreateDraftPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { enabled: liveEnabled } = useFeatureFlag('live-draft');
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

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
          ...(liveEnabled && isLive
            ? {
                is_live: true,
                kiosk_code: newKioskCode(),
                timer_seconds: pickSeconds,
                live_settings: {
                  ...DEFAULT_LIVE_SETTINGS,
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
        } as any)
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

      toast.success('Draft created!');
      navigate(`/drafts/${draft.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create draft');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto pb-6 da-ledger-page">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/drafts" className="da-back" aria-label="Back to Drafts">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="page-header mb-0 flex-1"
        >
          <div className="da-page-icon">
            <Bookmark className="w-5 h-5" />
          </div>
          <div>
            <h1 className="page-header-title dl-display">Create Draft</h1>
            <p className="page-header-subtitle">Set up a snake draft for the crew</p>
          </div>
        </motion.div>
      </div>

      <motion.form onSubmit={(e) => { if (step < STEPS.length - 1) { e.preventDefault(); if (topic.trim()) setStep(step + 1); return; } handleCreate(e); }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="space-y-5">
        <ol className="flex items-center gap-1.5" aria-label="Steps">
          {STEPS.map((label, i) => (
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
        <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}
          className="da-glass da-ledger-section p-5 space-y-5">
          {step === 0 && (<>
          <div>
            <label className="form-label">Topic</label>
            <Input
              required
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Best Fast Food Items"
              maxLength={100}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Description <span className="normal-case font-normal tracking-normal">(optional)</span></label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What are we drafting?"
              maxLength={200}
              className="form-input"
            />
          </div>
          </>)}
          {step === 1 && (<>
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
              <span className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: 'hsl(var(--gold))' }}>AI Judging Context</span>
              <span className="text-[10px] font-medium text-muted-foreground/60 normal-case tracking-normal">optional</span>
            </div>
            <Textarea
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
          {step === 2 && (<>
          {/* Live draft hosting — host the room in person, project the board. */}
          {liveEnabled && (
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
                      {PICK_SECONDS_OPTIONS.map(sec => (
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

          <div>
            <label className="form-label flex items-baseline justify-between">
              <span>Rounds</span>
              <span className="text-[10px] font-semibold normal-case tracking-normal text-muted-foreground/70">{numRounds} picks each</span>
            </label>
            <div className="flex gap-2">
              {[3, 5, 7, 10].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNumRounds(n)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all btn-press ${
                    numRounds === n ? 'shadow-md' : 'text-muted-foreground'
                  }`}
                  style={
                    numRounds === n
                      ? {
                          background: 'hsl(var(--primary))',
                          color: 'hsl(var(--primary-foreground))',
                          boxShadow: 'inset 0 1px 0 hsl(var(--foreground) / 0.12)',
                        }
                      : { background: 'hsl(var(--muted) / 0.6)', border: '1px solid hsl(var(--gold) / 0.18)' }
                  }
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          </>)}
          {step === 3 && (
            <div>
              <p className="form-label">Review</p>
              <DaInfoRow icon={Bookmark} label="Topic" value={topic.trim() || '—'} />
              {description.trim() && <DaInfoRow icon={Bookmark} label="Description" value={description.trim()} />}
              <DaInfoRow icon={Sparkles} label="AI judging context" value={aiContext.trim() ? 'Added' : 'None'} />
              <DaInfoRow icon={Bookmark} label="Rounds" value={`${numRounds} picks each`} />
              {liveEnabled && <DaInfoRow icon={Radio} label="Live draft" value={isLive ? `On · ${pickSeconds >= 60 ? `${pickSeconds / 60}m` : `${pickSeconds}s`} per pick` : 'Off'} />}
            </div>
          )}
        </motion.div>
        </AnimatePresence>

        <div className="flex gap-2">
        {step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)} className="h-12 px-5 rounded-lg border border-border font-bold text-[13px] btn-press">Back</button>
        )}
        <button
          type="submit"
          disabled={loading || !topic.trim()}
          className="flex-1 h-12 rounded-lg font-black uppercase tracking-[0.14em] text-[13px] btn-press transition-all disabled:cursor-not-allowed"
          style={{
             color: loading || !topic.trim() ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary-foreground))',
            background: loading || !topic.trim()
              ? 'hsl(var(--muted) / 0.6)'
               : 'hsl(var(--primary))',
            border: loading || !topic.trim()
              ? '1px solid hsl(var(--border))'
               : '1px solid hsl(var(--primary) / 0.65)',
            boxShadow: loading || !topic.trim()
              ? 'none'
               : '0 6px 18px hsl(var(--background) / 0.55), inset 0 1px 0 hsl(var(--foreground) / 0.12)',
            opacity: loading || !topic.trim() ? 0.9 : 1,
          }}
        >
          {loading ? 'Creating…' : step < STEPS.length - 1 ? 'Next' : 'Create Draft'}
        </button>
        </div>
      </motion.form>
    </div>
  );
}
