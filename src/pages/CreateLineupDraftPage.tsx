import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronRight, Layers3, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createLineupDraft, lineupError } from '@/hooks/useLineupDraft';
import { LINEUP_TEMPLATES, createLineupConfig, parseLineupConfig, type LineupConfig } from '@/lib/draft/lineup';
import { LineupArtwork } from '@/components/draft/lineup/LineupArtwork';
import { clearLineupCreateReceipt, clearRejectedLineupCreateReceipt, lineupCreateKey, readLineupCreateReceipt, writeLineupCreateReceipt, type LineupCreateReceipt } from '@/components/draft/lineup/lineupCreateReceipt';
import '@/components/draft/lineup/lineup.css';

const STEPS = ['Lineup', 'Topic', 'Review'];

export default function CreateLineupDraftPage() {
  const { user, loading: authLoading } = useAuth();
  const { club, loading: clubLoading } = useClub();
  const [search] = useSearchParams();
  const location = useLocation();
  const previous = location.state as { lineupConfig?: unknown; topic?: unknown } | null;
  const previousConfig = parseLineupConfig(previous?.lineupConfig);
  const previousTopic = typeof previous?.topic === 'string' && previous.topic.length <= 100 ? previous.topic : undefined;
  if (authLoading || clubLoading) return <section className="da-lineup da-lineup-state" role="status"><Loader2 className="animate-spin" aria-hidden="true" /><p>Opening setup…</p></section>;
  if (!user || !club) return <section className="da-lineup da-lineup-state"><Layers3 aria-hidden="true" /><h1>Choose your club</h1><Link to="/drafts" className="da-cta">Back to Draft Arena</Link></section>;
  return <LineupSetup key={`${user.id}:${club.id}`} userId={user.id} clubId={club.id} requestedTemplate={search.get('template')} previousConfig={previousConfig} previousTopic={previousTopic} />;
}

function LineupSetup({ userId, clubId, requestedTemplate, previousConfig, previousTopic }: { userId: string; clubId: string; requestedTemplate: string | null; previousConfig: LineupConfig | null; previousTopic?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const key = lineupCreateKey(userId, clubId);
  const [receipt, setReceipt] = useState(() => readLineupCreateReceipt(key));
  const initialTemplate = LINEUP_TEMPLATES.find(template => template.id === (previousConfig?.template_id ?? requestedTemplate)) ?? LINEUP_TEMPLATES[0];
  const [config, setConfig] = useState<LineupConfig>(() => receipt?.lineupConfig ?? previousConfig ?? createLineupConfig(initialTemplate.id));
  const [topic, setTopic] = useState(() => receipt?.topic ?? previousTopic ?? initialTemplate.topic);
  const [description, setDescription] = useState(() => receipt?.description ?? '');
  const [aiContext, setAiContext] = useState(() => receipt?.aiContext ?? '');
  const [step, setStep] = useState(() => receipt ? 2 : 0);
  const [editingSlots, setEditingSlots] = useState(initialTemplate.id === 'custom');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const inFlight = useRef(false);
  const active = useRef(true);
  const stage = useRef<HTMLDivElement>(null);
  const previousStep = useRef(step);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    const scroller = stage.current?.closest<HTMLElement>('#draft-arena-main');
    if (scroller) scroller.scrollTop = 0;
    stage.current?.focus({ preventScroll: true });
  }, [step]);

  const template = LINEUP_TEMPLATES.find(item => item.id === config.template_id);
  const validConfig = parseLineupConfig({ ...config, slots: config.slots.map(slot => ({ ...slot, label: slot.label.trim(), ...(slot.description !== undefined ? { description: slot.description.trim() } : {}) })) });
  const chooseTemplate = (id: string) => {
    if (receipt) return;
    const next = LINEUP_TEMPLATES.find(item => item.id === id);
    if (!next) return;
    const previousTemplate = LINEUP_TEMPLATES.find(item => item.id === config.template_id);
    setConfig(createLineupConfig(id));
    if (!topic.trim() || topic === previousTemplate?.topic) setTopic(next.topic);
    setEditingSlots(id === 'custom');
    setError('');
  };
  const changeSlot = (index: number, field: 'label' | 'description', value: string) => {
    setConfig(previous => ({ ...previous, slots: previous.slots.map((slot, position) => position === index ? { ...slot, [field]: value } : slot) }));
    setError('');
  };
  const moveSlot = (index: number, direction: number) => {
    const target = index + direction;
    if (target < 0 || target >= config.slots.length) return;
    setConfig(previous => {
      const slots = [...previous.slots];
      [slots[index], slots[target]] = [slots[target], slots[index]];
      return { ...previous, slots };
    });
  };
  const nextStep = () => {
    if (step === 0 && !validConfig) { setError('Give each slot a name. A lineup needs 2–20 slots.'); return; }
    if (step === 1 && !topic.trim()) { setError('Give your draft a topic.'); return; }
    if (step === 0 && validConfig) setConfig(validConfig);
    setError(''); setStep(previous => Math.min(2, previous + 1));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (step < 2) { nextStep(); return; }
    if (inFlight.current) return;
    if (!validConfig || !topic.trim()) { setError('Check your topic and lineup before creating the draft.'); return; }
    let pending: LineupCreateReceipt;
    try {
      const recovered = !receipt && readLineupCreateReceipt(key);
      if (recovered) {
        setReceipt(recovered); setConfig(recovered.lineupConfig); setTopic(recovered.topic);
        setDescription(recovered.description); setAiContext(recovered.aiContext); setStep(2);
        setError('Review the saved request, then retry to confirm it.');
        return;
      }
      pending = receipt ?? { requestId: crypto.randomUUID(), topic: topic.trim(), description: description.trim(), aiContext: aiContext.trim(), lineupConfig: validConfig };
      // Save before sending. A lost response can safely be retried after reload.
      setStorageUnavailable(!writeLineupCreateReceipt(key, pending));
    } catch (failure) { setError(lineupError(failure, 'Your draft request could not be saved. Try again.')); return; }
    setReceipt(pending);
    inFlight.current = true;
    setSending(true); setError('');
    try {
      const result = await createLineupDraft({ clubId, userId, ...pending });
      clearLineupCreateReceipt(key, pending.requestId);
      void queryClient.invalidateQueries({ queryKey: ['draft-lineup-list', clubId, userId] });
      if (active.current) navigate(`/drafts/lineup/${encodeURIComponent(result.draft_id)}`, { replace: true });
    } catch (failure) {
      if (active.current) {
        setError(lineupError(failure, 'The draft was not confirmed. Retry to check the same request safely.'));
        // Returned SQL rejections roll back the transaction, so corrections
        // can safely create a new request. Ambiguous network errors retain it.
        if (clearRejectedLineupCreateReceipt(key, pending.requestId, failure)) {
          setReceipt(null); setStorageUnavailable(false);
        }
      }
    } finally {
      inFlight.current = false;
      if (active.current) setSending(false);
    }
  };

  return <section className="da-lineup da-lineup-create da-ledger-page" aria-labelledby="lineup-setup-title" data-lineup-step={step + 1}>
    <header className="da-lineup-page-header">
      <Link to="/drafts/lineup" className="da-back" aria-label="Back to Lineup Drafts"><ArrowLeft aria-hidden="true" /></Link>
      <div><p className="da-arena-eyebrow">DRAFT ARENA · LINEUP</p><h1 id="lineup-setup-title">Create lineup</h1></div>
      <span className="da-lineup-count"><Layers3 aria-hidden="true" />{config.slots.length}<small>slots</small></span>
    </header>
    <ol className="da-lineup-steps" aria-label="Setup progress">
      {STEPS.map((name, index) => <li key={name} data-current={index === step} data-complete={index < step} aria-current={index === step ? 'step' : undefined}><span>{index < step ? <Check aria-hidden="true" /> : index + 1}</span><b>{name}</b></li>)}
    </ol>
    <form onSubmit={event => void submit(event)} aria-label="Create lineup draft" aria-busy={sending}>
      <div className="da-lineup-setup-stage" ref={stage} tabIndex={-1}>
        {step === 0 && <>
          <div className="da-lineup-section-heading"><h2>{editingSlots ? 'Your slots' : 'Choose your lineup'}</h2>{editingSlots && <Button variant="ghost" type="button" className="min-h-11" onClick={() => setEditingSlots(false)}>Templates</Button>}</div>
          {!editingSlots && <div className="da-lineup-template-grid" role="group" aria-label="Lineup templates">
            {LINEUP_TEMPLATES.map(item => <button type="button" key={item.id} className="da-lineup-template" data-selected={config.template_id === item.id} aria-pressed={config.template_id === item.id} onClick={() => chooseTemplate(item.id)}>
              <LineupArtwork template={item.id} />
              <span className="da-lineup-template-copy"><b>{item.name}</b><small>{item.description}</small></span>
              <span className="da-lineup-template-size">{item.slots.length} slots{config.template_id === item.id ? <Check aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}</span>
            </button>)}
          </div>}
          {editingSlots ? <div className="da-lineup-slot-editor" role="region" aria-label="Lineup slots">
            {config.slots.map((slot, index) => <div className="da-lineup-slot-editor-row" key={slot.id}>
              <span className="da-lineup-slot-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <div className="da-lineup-slot-editor-fields"><Input aria-label={`Slot ${index + 1} name`} placeholder="Slot name" value={slot.label} maxLength={36} onChange={event => changeSlot(index, 'label', event.target.value)} /><Input aria-label={`Slot ${index + 1} guidance`} placeholder="Role guidance (optional)" value={slot.description ?? ''} maxLength={120} onChange={event => changeSlot(index, 'description', event.target.value)} /></div>
              <div className="da-lineup-slot-tools"><Button variant="ghost" type="button" size="icon" aria-label={`Move slot ${index + 1} up`} disabled={index === 0} onClick={() => moveSlot(index, -1)}><ArrowUp aria-hidden="true" /></Button><Button variant="ghost" type="button" size="icon" aria-label={`Move slot ${index + 1} down`} disabled={index === config.slots.length - 1} onClick={() => moveSlot(index, 1)}><ArrowDown aria-hidden="true" /></Button><Button variant="ghost" type="button" size="icon" aria-label={`Remove slot ${index + 1}`} disabled={config.slots.length <= 2} onClick={() => setConfig(previous => ({ ...previous, slots: previous.slots.filter((_, position) => position !== index) }))}><Trash2 aria-hidden="true" /></Button></div>
            </div>)}
            <Button type="button" variant="outline" className="da-lineup-add-slot" disabled={config.slots.length >= 20} onClick={() => setConfig(previous => ({ ...previous, slots: [...previous.slots, { id: `slot-${crypto.randomUUID().slice(0, 8)}`, label: '', description: '' }] }))}><Plus aria-hidden="true" />Add slot<span>{config.slots.length}/20</span></Button>
          </div> : <div className="da-lineup-template-preview"><div><b>{template?.name ?? 'Your lineup'}</b><span>{config.slots.length} picks each · fill in any order</span></div><div className="da-lineup-slot-chips">{config.slots.map(slot => <span key={slot.id}>{slot.label}</span>)}</div><Button type="button" variant="outline" className="min-h-11" onClick={() => setEditingSlots(true)}><Pencil aria-hidden="true" />Edit slots</Button></div>}
        </>}
        {step === 1 && <div className="da-lineup-topic-form">
          <div className="da-lineup-section-heading"><h2>What are we drafting?</h2></div>
          <label htmlFor="lineup-topic">Draft topic<Input id="lineup-topic" value={topic} maxLength={100} placeholder="e.g. Fictional-character football team" onChange={event => { setTopic(event.target.value); setError(''); }} required /></label>
          <label htmlFor="lineup-description">Description <small>Optional</small><Textarea id="lineup-description" value={description} maxLength={200} rows={2} onChange={event => setDescription(event.target.value)} placeholder="A short invitation for the crew" /></label>
          <label htmlFor="lineup-judging">Judging notes <small>Optional</small><Textarea id="lineup-judging" value={aiContext} maxLength={1000} rows={3} onChange={event => setAiContext(event.target.value)} placeholder="Any limits on who or what can be picked?" /></label>
          <div className="da-lineup-judging-note"><Layers3 aria-hidden="true" /><p>Picks are judged for their assigned role. The full lineup is considered together.</p></div>
        </div>}
        {step === 2 && <div className="da-lineup-create-review">
          <LineupArtwork template={config.template_id} />
          <p className="da-arena-eyebrow">{template?.name ?? 'Custom lineup'}</p><h2>{topic}</h2>
          {description && <p className="da-lineup-review-description">{description}</p>}
          <div className="da-lineup-review-meta"><span><b>{config.slots.length}</b> slots each</span><span>Snake order</span><span>Any slot, any turn</span></div>
          <div className="da-lineup-review-slots" aria-label="Required lineup slots">{config.slots.map((slot, index) => <div key={slot.id}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{slot.label}</b>{slot.description && <small>{slot.description}</small>}</div></div>)}</div>
          {aiContext && <div className="da-lineup-review-notes"><h3>Judging notes</h3><p>{aiContext}</p></div>}
          <p className="da-lineup-review-footnote">Everyone gets this lineup. Slots lock when the draft starts.</p>
        </div>}
      </div>
      {receipt && !sending && <p className="da-lineup-retry-note" role="status">Your request is saved. Retry to confirm it without creating another draft.</p>}
      {storageUnavailable && <p className="da-lineup-retry-note" role="status">This browser cannot save a recovery copy. Keep this screen open until your draft is confirmed.</p>}
      {error && <p role="alert" className="da-lineup-error">{error}</p>}
      <div className="da-lineup-create-actions">
        {step > 0 && !receipt && <Button type="button" variant="outline" onClick={() => { setError(''); setStep(previous => previous - 1); }}><ArrowLeft aria-hidden="true" />Back</Button>}
        <Button type="submit" className="da-cta" disabled={sending || (step === 0 && !validConfig) || (step > 0 && !topic.trim())}>{sending ? <><Loader2 className="animate-spin" aria-hidden="true" />Creating…</> : step < 2 ? <>Next<ArrowRight aria-hidden="true" /></> : receipt ? <>Retry creation<ArrowRight aria-hidden="true" /></> : <>Create lineup<ArrowRight aria-hidden="true" /></>}</Button>
      </div>
    </form>
  </section>;
}
