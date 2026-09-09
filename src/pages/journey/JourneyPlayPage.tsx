import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Heart, Coins, ShieldAlert, Sparkles, ScrollText } from 'lucide-react';
import { JourneyLayout, JourneyError, JourneySkeleton } from '@/components/journey/JourneyLayout';
import { SceneBlocks } from '@/components/journey/SceneBlocks';
import { ChoiceList } from '@/components/journey/ChoiceList';
import { SceneAtmosphere } from '@/components/journey/SceneAtmosphere';
import { ChapterInterstitial } from '@/components/journey/ChapterInterstitial';
import { useJourneySettings } from '@/components/journey/useJourneySettings';
import { isImageUrl } from '@/lib/journey/art';
import { loadReadPos, saveReadPos, type ReadPos } from '@/lib/journey/progress';
import { useJourneyRun } from '@/hooks/useJourneyRun';
import { useJourneyEnding } from '@/hooks/useJourneyEnding';
import { EndingScreen } from '@/components/journey/EndingScreen';
import { AdventureEncounter } from '@/components/journey/AdventureEncounter';
import { exposureBand } from '@/lib/journey/adventure';

/**
 * The reading surface. A scene narrates in panels — a change of place or time
 * (a divider) is a Continue button to the next panel — and its choices follow
 * the final panel. Choosing advances to the next scene.
 */
export default function JourneyPlayPage() {
  const { runId } = useParams<{ runId: string }>();
  const {
    run, campaign, scene, chapterTitle, locationName, blocks, choices, encounter, state,
    loading, busy, error, notices, clearNotices, refresh, chooseChoice, resolveEncounterAction, advance,
  } = useJourneyRun(runId);
  const topRef = useRef<HTMLDivElement>(null);
  const { reducedMotion } = useJourneySettings();
  const ended = run?.status === 'completed' || Boolean(scene?.is_terminal);
  const { ending, loading: endingLoading } = useJourneyEnding(ended ? runId : undefined, ended);

  // Choices appear once the scene has finished narrating its final panel.
  const [told, setTold] = useState(false);
  useEffect(() => { setTold(false); }, [scene?.scene_key, blocks]);

  // ── Reading-position persistence ──────────────────────────────────────────
  // Survive the reloads a backgrounded mobile webview forces on us. The run is
  // already safe (server-side, keyed by runId); here we remember the panel and
  // scroll so a reload returns to the same spot instead of the top of the scene.
  const savedRef = useRef<ReadPos | null>(loadReadPos(runId));
  const posRef = useRef<ReadPos>({ sceneKey: '', panel: 0, scrollY: 0 });
  const restoring = savedRef.current != null && savedRef.current.sceneKey === scene?.scene_key;
  const initialPanel = restoring ? savedRef.current!.panel : undefined;

  const persist = (patch: Partial<ReadPos>) => {
    posRef.current = { ...posRef.current, ...patch };
    saveReadPos(runId, posRef.current);
  };

  // On entering a scene, seed the stored position (restored panel or 0).
  useEffect(() => {
    if (!scene?.scene_key) return;
    posRef.current = { sceneKey: scene.scene_key, panel: initialPanel ?? 0, scrollY: window.scrollY };
    saveReadPos(runId, posRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.scene_key]);

  // Track scroll cheaply; flush hard when the page is about to be torn down.
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; posRef.current.scrollY = window.scrollY; });
    };
    const flush = () => { posRef.current.scrollY = window.scrollY; saveReadPos(runId, posRef.current); };
    const onVis = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVis);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [runId]);

  // Announce a new chapter with a brief cinematic curtain — once per chapter,
  // never on reduced motion, never before the ending.
  const [chapterCurtain, setChapterCurtain] = useState<string | null>(null);
  const seenChapterRef = useRef<string | null>(null);
  useEffect(() => {
    if (reducedMotion || ended || !chapterTitle) return;
    if (seenChapterRef.current === chapterTitle) return;
    const first = seenChapterRef.current === null;
    seenChapterRef.current = chapterTitle;
    if (!first) setChapterCurtain(chapterTitle);
  }, [chapterTitle, reducedMotion, ended]);

  // A fresh scene starts at the top; a restored one returns to where you were.
  useEffect(() => {
    if (restoring && savedRef.current) {
      const y = savedRef.current.scrollY;
      savedRef.current = null; // restore only once
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y })));
    } else {
      topRef.current?.scrollIntoView({ block: 'start' });
      window.scrollTo({ top: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.scene_key]);

  useEffect(() => {
    if (notices.length === 0) return;
    const t = setTimeout(clearNotices, 4000);
    return () => clearTimeout(t);
  }, [notices, clearNotices]);

  if (loading) {
    return <JourneyLayout><div className="pt-6"><JourneySkeleton lines={8} /></div></JourneyLayout>;
  }
  if (error || !run) {
    return <JourneyLayout><div className="pt-6"><JourneyError message={error ?? 'This journey could not be loaded.'} onRetry={refresh} /></div></JourneyLayout>;
  }

  const hasArt = isImageUrl(scene?.background_asset);
  const exposure = exposureBand(state);
  const activeQuestCount = Object.values(state.quests ?? {}).filter((quest) => quest.status === 'active').length;

  return (
    <JourneyLayout>
      <div ref={topRef} />
      <SceneAtmosphere
        sceneKey={scene?.scene_key}
        sceneType={scene?.scene_type}
        backgroundAsset={hasArt ? undefined : scene?.background_asset}
      />
      {chapterCurtain && (
        <ChapterInterstitial title={chapterCurtain} onDone={() => setChapterCurtain(null)} />
      )}

      <div className="jy-adventure-hud mb-4" aria-label="Journey status">
        <span className="jy-chip"><Heart className="h-3 w-3" aria-hidden /> {state.health}/{state.max_health}</span>
        <span className="jy-chip"><Sparkles className="h-3 w-3" aria-hidden /> Level {state.level} · {state.xp} XP</span>
        <span className={`jy-chip jy-exposure-${exposure.band}`} title={`${exposure.value} exposure`}>
          <ShieldAlert className="h-3 w-3" aria-hidden /> {exposure.label}
        </span>
        {activeQuestCount > 0 && (
          <span className="jy-chip"><ScrollText className="h-3 w-3" aria-hidden /> {activeQuestCount} active {activeQuestCount === 1 ? 'quest' : 'quests'}</span>
        )}
        {state.gold > 0 && <span className="jy-chip"><Coins className="h-3 w-3" aria-hidden /> {state.gold}</span>}
        {run.is_test_run && <span className="jy-chip jy-chip-blood">Test run</span>}
      </div>

      {hasArt && (
        <figure className="jy-scene-banner jy-fade-in" key={scene?.scene_key}>
          <img src={scene!.background_asset!} alt="" loading="lazy" decoding="async" />
        </figure>
      )}

      <header className="jy-focal mb-6">
        <div className="jy-eyebrow">
          {[campaign?.title, chapterTitle, locationName].filter(Boolean).join(' · ')}
        </div>
        {scene?.title && <h1 className="jy-title mt-1">{scene.title}</h1>}
        {scene?.subtitle && <p className="jy-secondary text-sm italic">{scene.subtitle}</p>}
      </header>

      {scene ? (
        <>
          <SceneBlocks
            key={scene.scene_key}
            blocks={blocks}
            initialPanel={initialPanel}
            onPanel={(p) => persist({ panel: p })}
            onDone={() => setTold(true)}
          />

          {told && encounter && (
            <div className="jy-fade-in mt-8">
              <AdventureEncounter
                encounter={encounter}
                state={state}
                busy={busy}
                onAction={(actionKey) => { void resolveEncounterAction(actionKey); }}
              />
            </div>
          )}

          {ended ? (
            told && <EndingScreen payload={ending} loading={endingLoading} campaignTitle={campaign?.title} />
          ) : encounter && !encounter.resolved ? null : choices.length > 0 ? (
            told && <div className="jy-fade-in"><ChoiceList choices={choices} busy={busy} onChoose={chooseChoice} /></div>
          ) : scene?.has_auto_next ? (
            told && (
              <div className="jy-fade-in mt-8 text-center">
                <button type="button" className="jy-btn jy-btn-primary" disabled={busy} onClick={() => { void advance(); }}>
                  {busy ? 'The tale moves…' : 'Continue'}
                </button>
              </div>
            )
          ) : (
            told && (
              <div className="jy-panel mt-8 p-4 text-center">
                <p className="jy-secondary text-sm">
                  No path leads onward from here yet. This is an authoring gap, not your doing.
                </p>
                <Link className="jy-btn jy-btn-ghost mt-3" to="/journey">Return to the campaign hall</Link>
              </div>
            )
          )}
        </>
      ) : (
        <JourneyError message="The next scene is missing from this campaign." onRetry={refresh} />
      )}

      {notices.length > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-40 mx-auto max-w-sm px-4" role="status" aria-live="polite">
          <div className="jy-panel-raised space-y-1 p-3 text-center text-sm" style={{ color: 'hsl(var(--jy-gold))' }}>
            {notices.map((n, i) => <div key={i}>{n}</div>)}
          </div>
        </div>
      )}
    </JourneyLayout>
  );
}
