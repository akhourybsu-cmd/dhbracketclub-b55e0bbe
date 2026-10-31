import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ListPlus, Loader2, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useDraftDesk } from '@/hooks/useDraftDesk';

interface PersonalDraftDeskProps {
  draftId?: string; userId?: string; taken: Set<string>; onChoose?: (title: string) => void; compact?: boolean;
}

export function PersonalDraftDesk(props: PersonalDraftDeskProps) {
  return <DraftDeskSession key={JSON.stringify([props.userId ?? null, props.draftId ?? null])} {...props} />;
}

function errorMessage(error: unknown, fallback: string) {
  const message = error && typeof error === 'object' && 'message' in error ? error.message : null;
  return typeof message === 'string' && message ? message : fallback;
}

/** Private form and query state belongs to one account and one draft. */
function DraftDeskSession({ draftId, userId, taken, onChoose, compact = false }: PersonalDraftDeskProps) {
  const desk = useDraftDesk(draftId, userId);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [expanded, setExpanded] = useState(!compact);
  const [saving, setSaving] = useState(false);
  const savePending = useRef(false);
  const active = useRef(true);
  useLayoutEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const save = async () => {
    if (!title.trim() || savePending.current) return;
    savePending.current = true;
    setSaving(true);
    try {
      await desk.add(title, notes);
      if (!active.current) return;
      setTitle(''); setNotes(''); toast.success('Added to your desk');
    }
    catch (err: unknown) { if (active.current) toast.error(errorMessage(err, 'Could not save that idea')); }
    finally {
      savePending.current = false;
      if (active.current) setSaving(false);
    }
  };
  const act = async (work: Promise<void>) => { try { await work; } catch (err: unknown) { if (active.current) toast.error(errorMessage(err, 'Your desk could not be updated')); } };
  const normalizedTaken = (value: string) => taken.has(value.trim().toLowerCase());
  const available = desk.items.filter(item => !normalizedTaken(item.title));
  const visible = expanded ? desk.items : available.slice(0, 3);

  return <section className={cn('da-desk', compact && 'da-desk-compact')}>
    <button type="button" className="da-desk-heading" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>
      <span className="da-desk-mark"><ListPlus className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1 text-left"><strong className="dl-display">My Draft Desk</strong><small>{available.length} available · private to you</small></span>
      <span className="dl-eyebrow">{expanded ? 'Close' : 'Open'}</span>
    </button>
    {expanded && <div className="da-desk-body">
      <div className="grid gap-2 sm:grid-cols-[1fr_1.25fr_auto]">
        <Input value={title} disabled={saving} onChange={event => setTitle(event.target.value)} placeholder="Save an idea…" maxLength={100} onKeyDown={event => { if (event.key === 'Enter') void save(); }} />
        <Textarea value={notes} disabled={saving} onChange={event => setNotes(event.target.value)} placeholder="Private note (optional)" maxLength={500} className="min-h-11 h-11 resize-none" />
        <Button type="button" onClick={() => void save()} disabled={!title.trim() || saving} aria-busy={saving} className="h-11">{saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ListPlus className="h-4 w-4" />}<span className="sr-only">Add idea</span></Button>
      </div>
      {desk.error && <div className="da-desk-error"><span>{desk.error}</span><Button variant="ghost" size="sm" onClick={() => void desk.refresh()}>Retry</Button></div>}
      <div className="da-desk-list">
        {desk.loading ? <p className="text-xs text-muted-foreground animate-pulse">Opening your desk…</p> : visible.length === 0 ? <p className="da-desk-empty">Keep your next move ready here.</p> : visible.map((item, index) => {
          const unavailable = normalizedTaken(item.title);
          return <div key={item.id} className={cn('da-desk-item', item.is_on_deck && 'is-on-deck', unavailable && 'is-taken')}>
            <button type="button" className="da-desk-star" onClick={() => void act(desk.patch(item.id, { is_favorite: !item.is_favorite }))} aria-label={item.is_favorite ? 'Remove favorite' : 'Favorite'}><Star className={cn('h-4 w-4', item.is_favorite && 'fill-current')} /></button>
            <div className="min-w-0 flex-1"><p className="font-bold text-sm break-words">{item.title}</p>{item.notes && <p className="text-[10px] text-muted-foreground break-words">{item.notes}</p>}{unavailable && <span className="da-desk-taken">Already picked</span>}</div>
            {!unavailable && onChoose && <Button type="button" size="sm" variant={item.is_on_deck ? 'default' : 'outline'} className="h-9" onClick={() => onChoose(item.title)}>{item.is_on_deck ? <Check className="h-3.5 w-3.5" /> : null} Choose</Button>}
            <div className="da-desk-actions">
              <button type="button" onClick={() => void act(desk.move(item.id, -1))} disabled={index === 0} aria-label="Move up"><ArrowUp /></button>
              <button type="button" onClick={() => void act(desk.move(item.id, 1))} disabled={index === visible.length - 1} aria-label="Move down"><ArrowDown /></button>
              <button type="button" onClick={() => void act(desk.patch(item.id, { is_on_deck: true }))} aria-label="Set on deck"><Check /></button>
              <button type="button" onClick={() => void act(desk.remove(item.id))} aria-label="Delete idea"><Trash2 /></button>
            </div>
          </div>;
        })}
      </div>
    </div>}
  </section>;
}
