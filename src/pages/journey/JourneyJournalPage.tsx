import { useEffect, useState } from 'react';
import { ScrollText, CheckCircle2, XCircle, Circle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { JourneyLayout, JourneySkeleton } from '@/components/journey/JourneyLayout';
import { useJourneyLibrary } from '@/hooks/useJourneyLibrary';
import { useJourneyRun } from '@/hooks/useJourneyRun';
import { useJourneyWorld } from '@/hooks/useJourneyWorld';
import { NoRun } from './JourneyCharacterPage';
import type { QuestState } from '@/lib/journey/types';
import { parseDecisionImpact } from '@/lib/journey/agency';
import type { Json } from '@/integrations/supabase/types';

interface HistoryRow {
  id: string;
  choice_key: string | null;
  scene_key: string;
  choice_text_snapshot: string | null;
  created_at: string;
  metadata: Json;
}

/** Quest log + the record of decisions already made. */
export default function JourneyJournalPage() {
  const { currentRun, loading } = useJourneyLibrary();
  const { run, state, loading: runLoading } = useJourneyRun(currentRun?.id);
  const { world, objectiveText } = useJourneyWorld(currentRun?.id);
  const quests = world.quests;
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [tab, setTab] = useState<'quests' | 'decisions'>('quests');

  useEffect(() => {
    if (!run) return;
    let cancelled = false;
    (async () => {
      const h = await supabase.from('journey_run_choice_history')
        .select('id,choice_key,scene_key,choice_text_snapshot,created_at,metadata')
        .eq('run_id', run.id).order('created_at', { ascending: false }).limit(200);
      if (cancelled) return;
      setHistory((h?.data ?? []) as HistoryRow[]);
    })();
    return () => { cancelled = true; };
  }, [run]);

  if (loading || runLoading) {
    return <JourneyLayout><div className="pt-6"><JourneySkeleton lines={6} /></div></JourneyLayout>;
  }
  if (!currentRun) return <JourneyLayout><NoRun /></JourneyLayout>;

  const questStates = (state.quests ?? {}) as Record<string, QuestState>;
  const known = quests.filter((q) => questStates[q.quest_key] && questStates[q.quest_key].status !== 'not_started');

  return (
    <JourneyLayout>
      <header className="pt-2">
        <div className="jy-eyebrow">Journal</div>
        <h1 className="jy-display mt-1 text-2xl">The Record</h1>
        <div className="jy-rule mt-4" />
      </header>

      <div className="mt-4 flex gap-2" role="tablist">
        {(['quests', 'decisions'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`jy-btn jy-btn-sm ${tab === t ? 'jy-btn-primary' : 'jy-btn-ghost'}`}
            onClick={() => setTab(t)}
          >
            {t === 'quests' ? 'Quests' : 'Decisions'}
          </button>
        ))}
      </div>

      {tab === 'quests' ? (
        <section className="mt-4 space-y-3">
          {known.length === 0 ? (
            <EmptyNote text="No quests have found you yet." />
          ) : known.map((q) => {
            const st = questStates[q.quest_key];
            const Icon = st.status === 'completed' ? CheckCircle2 : st.status === 'failed' ? XCircle : Circle;
            const color = st.status === 'completed' ? 'hsl(150 30% 60%)'
              : st.status === 'failed' ? 'hsl(var(--jy-blood))' : 'hsl(var(--jy-gold))';
            return (
              <article key={q.quest_key} className="jy-panel p-4">
                <div className="flex items-start gap-2">
                  <Icon className="mt-1 h-4 w-4 shrink-0" style={{ color }} aria-hidden />
                  <div className="min-w-0">
                    <h2 className="jy-display text-base">{q.title}</h2>
                    {q.description && <p className="jy-prose mt-1 text-sm">{q.description}</p>}
                    {(q.objectives ?? []).length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {(q.objectives ?? []).map((o) => {
                          const done = st.status === 'completed';
                          return (
                            <li key={o.key} className="jy-secondary flex items-start gap-1.5 text-xs">
                              <span aria-hidden style={{ color: done ? 'hsl(150 30% 60%)' : 'hsl(var(--jy-gold))' }}>
                                {done ? '✓' : '•'}
                              </span>
                              <span className={done ? 'line-through opacity-70' : undefined}>{o.text}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="jy-chip">{q.quest_type}</span>
                      <span className="jy-chip">{st.status}</span>
                      {st.step && (
                        <span className="jy-chip jy-chip-gold">
                          {objectiveText(q.quest_key, st.step) ?? st.step}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="mt-4 space-y-2">
          {history.length === 0 ? (
            <EmptyNote text="No decisions recorded yet." />
          ) : history.map((h) => {
            const impact = parseDecisionImpact(h.metadata);
            return (
              <div key={h.id} className="jy-panel jy-decision-record p-3">
                {impact?.path_label && <span className="jy-chip jy-chip-gold mb-2 inline-flex">{impact.path_label} path</span>}
                <p className="jy-secondary text-sm">{h.choice_text_snapshot ?? h.choice_key}</p>
                {impact?.outcome_text && <p className="jy-prose mt-2 text-sm">{impact.outcome_text}</p>}
                {impact && impact.impact.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {impact.impact.map((item) => <span key={item} className="jy-chip">{item}</span>)}
                  </div>
                )}
                <p className="jy-muted mt-2 text-xs">
                  {h.scene_key} · {new Date(h.created_at).toLocaleString()}
                </p>
              </div>
            );
          })}
        </section>
      )}
    </JourneyLayout>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="jy-panel p-6 text-center">
      <ScrollText className="mx-auto mb-2 h-5 w-5" style={{ color: 'hsl(var(--jy-gold))' }} aria-hidden />
      <p className="jy-muted text-sm italic">{text}</p>
    </div>
  );
}
