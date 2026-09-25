import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Award, Crown, Sparkles, Trophy } from 'lucide-react';

interface KioskReportParticipant {
  user_id: string;
  profiles?: { display_name?: string } | null;
}

interface KioskPickRating {
  pick_id: string;
  pick_text: string;
  score: number;
  explanation: string;
}

interface KioskDraftResult {
  id: string;
  user_id: string;
  rank: number;
  total_score: number;
  summary?: string | null;
  pick_ratings?: KioskPickRating[] | null;
}

export function KioskDraftReport({
  topic,
  participants,
  results,
}: {
  topic: string;
  participants: KioskReportParticipant[];
  results: KioskDraftResult[];
}) {
  const reduceMotion = useReducedMotion();
  const ordered = useMemo(() => [...results].sort((a, b) => a.rank - b.rank), [results]);
  const pages = 1 + ordered.length;
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [topic, results.length]);

  useEffect(() => {
    if (pages <= 1 || reduceMotion) return;
    const timer = window.setInterval(() => setPage(current => (current + 1) % pages), 8500);
    return () => window.clearInterval(timer);
  }, [pages, reduceMotion]);

  const nameFor = (userId: string) =>
    participants.find(participant => participant.user_id === userId)?.profiles?.display_name || 'Unknown';
  const current = page === 0 ? null : ordered[page - 1];

  return (
    <section className="da-kiosk-report" aria-label="Final draft report">
      <div className="da-kiosk-report-rays" aria-hidden />
      <AnimatePresence mode="wait">
        {page === 0 ? (
          <motion.div
            key="standings"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -18 }}
            className="da-kiosk-report-page"
          >
            <div className="da-kiosk-report-heading">
              <Trophy aria-hidden />
              <p className="dl-eyebrow">Final draft report</p>
              <h2 className="dl-display">{topic}</h2>
            </div>
            <div className="da-kiosk-report-standings">
              {ordered.map(result => (
                <article key={result.id} className={result.rank === 1 ? 'is-winner' : ''}>
                  <span className="da-kiosk-report-rank dl-display">{result.rank}</span>
                  <div>
                    <strong className="dl-display">{nameFor(result.user_id)}</strong>
                    <small>{result.pick_ratings?.length ?? 0} scored picks</small>
                  </div>
                  <b className="dl-display">{Number(result.total_score).toFixed(1)}</b>
                  {result.rank === 1 ? <Crown aria-hidden /> : null}
                </article>
              ))}
            </div>
          </motion.div>
        ) : current ? (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reduceMotion ? 1 : 1.02 }}
            className="da-kiosk-report-page"
          >
            <div className="da-kiosk-report-player-head">
              <span className="da-kiosk-report-medal dl-display">#{current.rank}</span>
              <div>
                <p className="dl-eyebrow">Draft report · {Number(current.total_score).toFixed(1)} points</p>
                <h2 className="dl-display">{nameFor(current.user_id)}</h2>
              </div>
              <Award aria-hidden />
            </div>
            {current.summary ? <p className="da-kiosk-report-summary">{current.summary}</p> : null}
            <div className="da-kiosk-report-picks">
              {(current.pick_ratings ?? []).map((rating, index) => (
                <article key={rating.pick_id}>
                  <span className="dl-display">{index + 1}</span>
                  <div>
                    <strong>{rating.pick_text}</strong>
                    <small>{rating.explanation}</small>
                  </div>
                  <b className="dl-display">{Number(rating.score).toFixed(1)}</b>
                </article>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className="da-kiosk-report-progress" aria-label={`Report page ${page + 1} of ${pages}`}>
        {Array.from({ length: pages }, (_, index) => (
          <button key={index} type="button" onClick={() => setPage(index)} aria-label={`Show report page ${index + 1}`} className={index === page ? 'is-active' : ''} />
        ))}
      </div>
      <div className="da-kiosk-report-live"><Sparkles aria-hidden /> Full analysis broadcast</div>
    </section>
  );
}