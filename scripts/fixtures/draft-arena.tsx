/* eslint-disable react-refresh/only-export-components -- Standalone browser fixture entry point. */
// Production screens with browser-local auth and transport. No live writes.
// Match production: shared styles load before lazy Draft Arena presentation.
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/sora/800.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/work-sans/400.css";
import "@fontsource/work-sans/500.css";
import "@fontsource/work-sans/600.css";
import "@fontsource/work-sans/700.css";
import "../../src/index.css";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { DraftArenaLayout } from "../../src/components/drafts/DraftArenaLayout";
import DraftsListPage from "../../src/pages/DraftsListPage";
import LiveDraftsPage from "../../src/pages/LiveDraftsPage";
import DraftDetailPage from "../../src/pages/DraftDetailPage";
import CreateDraftPage from "../../src/pages/CreateDraftPage";
import SeasonsArchivePage from "../../src/pages/SeasonsArchivePage";
import SeasonArchiveDetailPage from "../../src/pages/SeasonArchiveDetailPage";
import DraftMagazinePage from "../../src/pages/DraftMagazinePage";
import { PersonalLiveKiosk } from "../../src/components/draft/live/PersonalLiveKiosk";
import { MakePickSheet } from "../../src/components/draft/MakePickSheet";
import { DraftBoard } from "../../src/components/draft/DraftBoard";
import { PersonalDraftDesk } from "../../src/components/draft/PersonalDraftDesk";
import { DraftBroadcastFeed } from "../../src/components/draft/DraftBroadcastFeed";
import { draftArenaFixture } from "./draft-arena-backend";

const params = new URLSearchParams(location.search);
const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
Object.assign(window, { daQueryClient: client });
function CurrentRoute() {
  const route = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    Object.assign(window, { daNavigate: navigate });
    return () => { Reflect.deleteProperty(window, "daNavigate"); };
  }, [navigate]);
  return <span hidden data-qa-route={route.pathname + route.search} />;
}
/** Presentation-only live clock, with production kiosk, board, desk and composer. */
function LiveWorkspaceFixture() {
  const [showPick, setShowPick] = useState(false);
  const [pickText, setPickText] = useState("");
  const [submits, setSubmits] = useState(0);
  const { tables, userId } = draftArenaFixture;
  const fixtureId = params.get('stress') === 'player-scroll' ? 'stress' : 'active';
  const draft = tables.drafts.find((row) => row.id === fixtureId)!;
  const picks = tables.draft_picks.filter((pick) => pick.draft_id === fixtureId);
  const participants = tables.draft_participants.filter((participant) => participant.draft_id === fixtureId).map((participant) => ({ ...participant, profiles: tables.profiles.find((profile) => profile.id === participant.user_id) }));
  const currentRound = Number(draft.current_round), currentPick = Number(draft.current_pick_number);
  const numRounds = Number(draft.num_rounds), totalPicks = participants.length * numRounds;
  const namedPicks = picks.map((pick) => ({ ...pick, name: tables.profiles.find((profile) => profile.id === pick.user_id)?.display_name || "Player" }));
  const enrichments = new Map(tables.item_enrichments.map((image) => [image.item_id, image]));
  return <>
    <output hidden data-testid="kiosk-composer-submits">{submits}</output>
    <PersonalLiveKiosk
      draftId={fixtureId} draftTitle={String(draft.topic)}
      clock={{ running: true, paused: true, remainingMs: 60_000, totalMs: 90_000, expired: false }}
      pickerName="Alex" isMyTurn picksUntilYou={0} currentRound={currentRound} numRounds={numRounds}
      currentPickNumber={currentPick} totalPicks={totalPicks} myPicks={picks.filter((pick) => pick.user_id === userId)}
      recentPicks={namedPicks.slice(-3)} allPicks={namedPicks} announce sound={false}
      onMakePick={() => setShowPick(true)} palette="heritage"
      board={<DraftBoard participants={participants} picks={picks} numRounds={numRounds} currentPickNumber={currentPick} currentUserId={userId} enrichments={enrichments} newPickIds={new Set()} />}
      desk={<PersonalDraftDesk draftId={fixtureId} userId={userId} taken={new Set(picks.map((pick) => pick.pick_text.toLowerCase()))} onChoose={setPickText} />}
      broadcast={<DraftBroadcastFeed picks={namedPicks} totalPicks={totalPicks} />}
      hostControls={<section className="dl-card p-4"><h2 className="dl-display">Host workspace</h2><p>Clock is paused for this isolated presentation check.</p></section>}
    />
    <MakePickSheet open={showPick} onClose={() => setShowPick(false)} currentRound={currentRound} currentPickNumber={currentPick}
      pickText={pickText} onTextChange={setPickText} onSubmit={() => { setSubmits((value) => value + 1); setShowPick(false); }}
      submitting={false} localDuplicate={false} suggestion={null} onApplyCorrection={setPickText} onDismissSuggestion={() => {}}
      topic={String(draft.topic)} draftId={fixtureId} userId={userId} />
  </>;
}
// Match App.tsx: the shell belongs inside each matched route, so its HUD/menu
// receive that route's draftId/seasonId through useParams.
function arena(screen: React.ReactNode) {
  return <DraftArenaLayout>{screen}</DraftArenaLayout>;
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme={params.get("theme") || "dark"} enableSystem={false} storageKey="da-qa-theme">
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[params.get("route") || "/drafts"]}>
          <CurrentRoute />
          <Routes>
            <Route path="/drafts" element={arena(<DraftsListPage />)} />
            <Route path="/drafts/live" element={arena(<LiveDraftsPage />)} />
            <Route path="/drafts/live/create" element={arena(<CreateDraftPage />)} />
            <Route path="/drafts/live/:draftId" element={arena(<DraftDetailPage />)} />
            <Route path="/drafts/create" element={arena(<CreateDraftPage />)} />
            <Route path="/drafts/:draftId/__qa/live" element={arena(<LiveWorkspaceFixture />)} />
            <Route path="/drafts/seasons" element={arena(<SeasonsArchivePage />)} />
            <Route path="/drafts/seasons/:seasonId" element={arena(<SeasonArchiveDetailPage />)} />
            <Route path="/drafts/:draftId" element={arena(<DraftDetailPage />)} />
            <Route path="/drafts/:draftId/magazine" element={arena(<DraftMagazinePage />)} />
            <Route path="*" element={<h1>App destination reached</h1>} />
          </Routes>
          <Toaster />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
