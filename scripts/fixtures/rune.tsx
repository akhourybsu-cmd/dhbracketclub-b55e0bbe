// Actual game pages and shell. Every backend operation is browser-local in rune-backend.ts.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AppLayout } from "../../src/components/AppLayout";
import { RuneDelveLayout } from "../../src/components/runedelve/RuneDelveLayout";
import { RuneBoard } from "../../src/components/runedelve/RuneBoard";
import RuneDelveHomePage from "../../src/pages/RuneDelveHomePage";
import RunePuzzleHomePage from "../../src/pages/RunePuzzleHomePage";
import RunePuzzleJourneyPage from "../../src/pages/RunePuzzleJourneyPage";
import RunePuzzlePlayPage from "../../src/pages/RunePuzzlePlayPage";
import RunePuzzleGuidePage from "../../src/pages/RunePuzzleGuidePage";
import RuneDelveLevelMapPage from "../../src/pages/RuneDelveLevelMapPage";
import RuneDelvePlayPage from "../../src/pages/RuneDelvePlayPage";
import RuneDelveResultsPage from "../../src/pages/RuneDelveResultsPage";
import RuneDelveHeroPage from "../../src/pages/RuneDelveHeroPage";
import RuneDelveArmoryPage from "../../src/pages/RuneDelveArmoryPage";
import RuneDelveShopPage from "../../src/pages/RuneDelveShopPage";
import RuneDelveDailyPage from "../../src/pages/RuneDelveDailyPage";
import RuneDelveEndlessPage from "../../src/pages/RuneDelveEndlessPage";
import RuneDelveQuestsPage from "../../src/pages/RuneDelveQuestsPage";
import RuneDelveBestiaryPage from "../../src/pages/RuneDelveBestiaryPage";
import RuneDelveLeaderboardPage from "../../src/pages/RuneDelveLeaderboardPage";
import RuneDelveHistoryPage from "../../src/pages/RuneDelveHistoryPage";
import RuneDelveExpeditionPage from "../../src/pages/RuneDelveExpeditionPage";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "../../src/index.css";
const params = new URLSearchParams(location.search);
function CurrentRoute() {
  const location = useLocation();
  return <span hidden data-qa-route={location.pathname + location.search} />;
}
function RuneBoardHarness() {
  const [count, setCount] = useState(0);
  return (
    <div data-testid="rune-board-harness">
      <h1>Rune controls</h1>
      <output data-testid="qa-chain-count">{count}</output>
      <RuneBoard
        grid={[
          ["red", "red", "red", "blue", "green"],
          ["blue", "blue", "blue", "green", "green"],
          ["green", "green", "green", "gold", "gold"],
          ["gold", "gold", "gold", "red", "red"],
          ["red", "blue", "green", "gold", "red"],
        ]}
        onChainComplete={() => setCount((value) => value + 1)}
      />
    </div>
  );
}
const client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
Object.assign(window, { runeQueryClient: client });
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider
      attribute="class"
      forcedTheme={params.get("theme") || "dark"}
    >
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[params.get("route") || "/rune-delve"]}>
          <AppLayout>
            <RuneDelveLayout>
              <CurrentRoute />
              <Routes>
                <Route path="/rune-delve" element={<RunePuzzleHomePage />} />
                <Route path="/rune-delve/journey" element={<RunePuzzleJourneyPage />} />
                <Route path="/rune-delve/chamber/:roomId" element={<RunePuzzlePlayPage />} />
                <Route path="/rune-delve/guide" element={<RunePuzzleGuidePage />} />
                <Route path="/rune-delve/legacy" element={<RuneDelveHomePage />} />
                <Route
                  path="/rune-delve/levels"
                  element={<RuneDelveLevelMapPage />}
                />
                <Route
                  path="/rune-delve/play/:levelNumber"
                  element={<RuneDelvePlayPage />}
                />
                <Route
                  path="/rune-delve/results/:levelNumber"
                  element={<RuneDelveResultsPage />}
                />
                <Route
                  path="/rune-delve/hero"
                  element={<RuneDelveHeroPage />}
                />
                <Route
                  path="/rune-delve/armory"
                  element={<RuneDelveArmoryPage />}
                />
                <Route
                  path="/rune-delve/shop"
                  element={<RuneDelveShopPage />}
                />
                <Route
                  path="/rune-delve/daily"
                  element={<RuneDelveDailyPage />}
                />
                <Route
                  path="/rune-delve/endless"
                  element={<RuneDelveEndlessPage />}
                />
                <Route
                  path="/rune-delve/quests"
                  element={<RuneDelveQuestsPage />}
                />
                <Route
                  path="/rune-delve/bestiary"
                  element={<RuneDelveBestiaryPage />}
                />
                <Route
                  path="/rune-delve/leaderboard"
                  element={<RuneDelveLeaderboardPage />}
                />
                <Route
                  path="/rune-delve/history"
                  element={<RuneDelveHistoryPage />}
                />
                <Route
                  path="/rune-delve/expedition"
                  element={<RuneDelveExpeditionPage />}
                />
                <Route
                  path="/rune-delve/__qa/board"
                  element={<RuneBoardHarness />}
                />
                <Route path="*" element={<h1>App destination reached</h1>} />
              </Routes>
            </RuneDelveLayout>
          </AppLayout>
          <Toaster />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
