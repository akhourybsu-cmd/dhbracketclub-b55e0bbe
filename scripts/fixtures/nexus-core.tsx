// Local QA entry only. Production routes import these exact game components.
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import NexusHomePage from "../../src/pages/NexusHomePage";
import NexusMissionsPage from "../../src/pages/NexusMissionsPage";
import NexusLoadoutPage from "../../src/pages/NexusLoadoutPage";
import NexusBattlePage from "../../src/pages/NexusBattlePage";
import NexusResultsPage from "../../src/pages/NexusResultsPage";
import NexusResearchPage from "../../src/pages/NexusResearchPage";
import NexusCodexPage from "../../src/pages/NexusCodexPage";
import NexusLeaderboardPage from "../../src/pages/NexusLeaderboardPage";
import { NexusLayout } from "../../src/components/nexus/NexusLayout";
import { createRun } from "../../src/lib/nexus/core/engine";
import { CAMPAIGN, ENDLESS } from "../../src/lib/nexus/core/catalog";
import { emptyMetrics } from "../../src/lib/nexus/core/systems";
import { saveCoreRun } from "../../src/lib/nexus/core/persistence";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "../../src/index.css";

// The browser check can stage a completed run without waiting several minutes.
Object.assign(window, {
  stageNexusBattle: () => {
    const run = createRun(ENDLESS);
    Object.assign(run, {
      registered: true,
      phase: "wave",
      wave: 5,
      cleared: 4,
      energy: 5000,
      metrics: emptyMetrics(5000),
      upgrades: { arc: 1, rail: 1, orbit: 2 },
      enemies: [
        {
          id: 901,
          kind: "tank",
          x: 160,
          y: 0,
          hp: 10000,
          maxHp: 10000,
          speed: 1,
          damage: 9,
          radius: 14,
          bounty: 17,
          attackCd: 99,
          slowed: 0,
        },
        {
          id: 902,
          kind: "drone",
          x: 100,
          y: 20,
          hp: 10000,
          maxHp: 10000,
          speed: 1,
          damage: 9,
          radius: 9,
          bounty: 7,
          attackCd: 99,
          slowed: 0,
        },
        {
          id: 903,
          kind: "swarm",
          x: 39,
          y: 0,
          hp: 10000,
          maxHp: 10000,
          speed: 1,
          damage: 9,
          radius: 5,
          bounty: 4,
          attackCd: 99,
          slowed: 0,
        },
      ],
    });
    saveCoreRun(run, "member", "club");
  },
  stageNexusResult: () => {
    const run = createRun(CAMPAIGN[0]);
    Object.assign(run, {
      phase: "victory",
      wave: 5,
      cleared: 5,
      hp: 170,
      kills: 85,
      score: 5000,
      time: 140,
    });
    saveCoreRun(run, "member", "club");
  },
});
const pages = [
  ["/nexus", <NexusHomePage />],
  ["/nexus/missions", <NexusMissionsPage />],
  ["/nexus/challenges", <NexusMissionsPage />],
  ["/nexus/loadout/:missionId", <NexusLoadoutPage />],
  ["/nexus/battle/:missionId", <NexusBattlePage />],
  ["/nexus/results/:missionId", <NexusResultsPage />],
  ["/nexus/research", <NexusResearchPage />],
  ["/nexus/codex", <NexusCodexPage />],
  ["/nexus/leaderboard", <NexusLeaderboardPage />],
] as const;
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    <MemoryRouter
      initialEntries={[
        new URLSearchParams(location.search).get("route") || "/nexus",
      ]}
    >
      <Routes>
        {pages.map(([path, page]) => (
          <Route
            key={path}
            path={path}
            element={<NexusLayout>{page}</NexusLayout>}
          />
        ))}
      </Routes>
      <Toaster />
    </MemoryRouter>
  </QueryClientProvider>,
);
