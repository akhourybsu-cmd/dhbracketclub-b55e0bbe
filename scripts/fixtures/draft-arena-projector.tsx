/* eslint-disable react-refresh/only-export-components -- Standalone browser fixture entry. */
// The real projector has no ArenaLayout/lazy Arena CSS dependency.
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
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import DraftKioskPage from "../../src/pages/DraftKioskPage";

const params = new URLSearchParams(location.search);
const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
Object.assign(window, { daQueryClient: client });
function CurrentRoute() {
  const route = useLocation();
  return <span hidden data-qa-route={route.pathname + route.search} />;
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme={params.get("theme") || "dark"} enableSystem={false} storageKey="da-qa-theme">
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[params.get("route") || "/drafts/active/kiosk"]}>
          <CurrentRoute />
          <Routes><Route path="/drafts/:draftId/kiosk" element={<DraftKioskPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
