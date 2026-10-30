// Production pages and app shell with isolated transport supplied by browser QA.
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AppLayout } from "../../src/components/AppLayout";
import DailyFindPage from "../../src/pages/DailyFindPage";
import DailyFindDetailPage from "../../src/pages/DailyFindDetailPage";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "../../src/index.css";
function CurrentRoute() {
  const location = useLocation();
  return <span hidden data-qa-route={location.pathname + location.search} />;
}
const params = new URLSearchParams(location.search);
createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" forcedTheme={params.get("theme") || "dark"}>
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[params.get("route") || "/finds"]}>
        <AppLayout>
          <CurrentRoute />
          <Routes>
            <Route path="/finds" element={<DailyFindPage />} />
            <Route path="/finds/:findId" element={<DailyFindDetailPage />} />
            <Route path="/chat" element={<h1>Chat reached</h1>} />
            <Route path="*" element={<h1>Another app page</h1>} />
          </Routes>
        </AppLayout>
        <Toaster />
      </MemoryRouter>
    </QueryClientProvider>
  </ThemeProvider>,
);
