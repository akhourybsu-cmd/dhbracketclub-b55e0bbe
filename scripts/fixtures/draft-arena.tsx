/* eslint-disable react-refresh/only-export-components -- Standalone browser fixture entry point. */
// Production screens with browser-local auth and transport. No live writes.
// Match production: shared styles load before lazy Draft Arena presentation.
import "../../src/index.css";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { DraftArenaLayout } from "../../src/components/drafts/DraftArenaLayout";
import DraftsListPage from "../../src/pages/DraftsListPage";
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
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";

const params = new URLSearchParams(location.search);
const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
Object.assign(window, { daQueryClient: client });
function CurrentRoute() {
  const route = useLocation();
  return <span hidden data-qa-route={route.pathname + route.search} />;
}
/** Presentation-only live clock, with production kiosk, board, desk and composer. */
function LiveWorkspaceFixture() {
  const [showPick, setShowPick] = useState(false);
  const [pickText, setPickText] = useState("");
  const [submits, setSubmits] = useState(0);
  const { tables, userId } = draftArenaFixture;
  const picks = tables.draft_picks.filter((pick) => pick.draft_id === "active");
  const participants = tables.draft_participants.filter((participant) => participant.draft_id === "active").map((participant) => ({ ...participant, profiles: tables.profiles.find((profile) => profile.id === participant.user_id) }));
  const namedPicks = picks.map((pick) => ({ ...pick, name: tables.profiles.find((profile) => profile.id === pick.user_id)?.display_name || "Player" }));
  const enrichments = new Map(tables.item_enrichments.map((image) => [image.item_id, image]));
  return <>
    <output hidden data-testid="kiosk-composer-submits">{submits}</output>
    <PersonalLiveKiosk
      draftTitle="Greatest movie night"
      clock={{ running: true, paused: true, remainingMs: 60_000, totalMs: 90_000, expired: false }}
      pickerName="Alex" isMyTurn picksUntilYou={0} currentRound={3} numRounds={4}
      currentPickNumber={7} totalPicks={12} myPicks={picks.filter((pick) => pick.user_id === userId)}
      recentPicks={namedPicks.slice(-3)} allPicks={namedPicks} announce sound={false}
      onMakePick={() => setShowPick(true)} palette="heritage"
      board={<DraftBoard participants={participants} picks={picks} numRounds={4} currentPickNumber={7} currentUserId={userId} enrichments={enrichments} newPickIds={new Set()} />}
      desk={<PersonalDraftDesk draftId="active" userId={userId} taken={new Set(picks.map((pick) => pick.pick_text.toLowerCase()))} onChoose={setPickText} />}
      broadcast={<DraftBroadcastFeed picks={namedPicks} totalPicks={12} />}
      hostControls={<section className="dl-card p-4"><h2 className="dl-display">Host workspace</h2><p>Clock is paused for this isolated presentation check.</p></section>}
    />
    <MakePickSheet open={showPick} onClose={() => setShowPick(false)} currentRound={3} currentPickNumber={7}
      pickText={pickText} onTextChange={setPickText} onSubmit={() => { setSubmits((value) => value + 1); setShowPick(false); }}
      submitting={false} localDuplicate={false} suggestion={null} onApplyCorrection={setPickText} onDismissSuggestion={() => {}}
      topic="Greatest movie night" draftId="active" userId={userId} />
  </>;
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" forcedTheme={params.get("theme") || "dark"}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[params.get("route") || "/drafts"]}>
          <DraftArenaLayout>
            <CurrentRoute />
            <Routes>
              <Route path="/drafts" element={<DraftsListPage />} />
              <Route path="/drafts/create" element={<CreateDraftPage />} />
              <Route path="/drafts/__qa/live" element={<LiveWorkspaceFixture />} />
              <Route path="/drafts/seasons" element={<SeasonsArchivePage />} />
              <Route path="/drafts/seasons/:seasonId" element={<SeasonArchiveDetailPage />} />
              <Route path="/drafts/:draftId" element={<DraftDetailPage />} />
              <Route path="/drafts/:draftId/magazine" element={<DraftMagazinePage />} />
              <Route path="*" element={<h1>App destination reached</h1>} />
            </Routes>
          </DraftArenaLayout>
          <Toaster />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
