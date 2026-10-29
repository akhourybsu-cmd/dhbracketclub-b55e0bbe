// Actual shared shell, Dashboard, Home signals, Drop composer and feat details.
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AppLayout } from "../../src/components/AppLayout";
import DashboardPage from "../../src/pages/DashboardPage";
import DHFeatsPage from "../../src/pages/DHFeatsPage";
import DailyFindPage from "../../src/pages/DailyFindPage";
import { createRun } from "../../src/lib/nexus/core/engine";
import { ENDLESS } from "../../src/lib/nexus/core/catalog";
import { saveCoreRun } from "../../src/lib/nexus/core/persistence";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "../../src/index.css";
Object.assign(window, {
  stageHomeRun: () => {
    const run = createRun(ENDLESS);
    run.registered = true;
    run.wave = 12;
    run.phase = "wave";
    saveCoreRun(run, "member", "club");
    window.dispatchEvent(new Event("focus"));
  },
});
const params = new URLSearchParams(location.search),
  theme = params.get("theme") || "dark";
function Destination() {
  const loc = useLocation();
  return (
    <div>
      <h1>Destination reached</h1>
      <p>{loc.pathname + loc.search}</p>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" forcedTheme={theme}>
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppLayout>
          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/feats" element={<DHFeatsPage />} />
            <Route path="/finds" element={<DailyFindPage />} />
            <Route path="*" element={<Destination />} />
          </Routes>
        </AppLayout>
        <Toaster />
      </MemoryRouter>
    </QueryClientProvider>
  </ThemeProvider>,
);
