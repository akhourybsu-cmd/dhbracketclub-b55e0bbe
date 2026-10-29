// Local QA entry: production board and hooks, with isolated PostgreSQL RPCs.
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import DHFeatsPage from "../../src/pages/DHFeatsPage";
import { DHScoreCard } from "../../src/components/feats/DHScoreCard";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "../../src/index.css";
const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <MemoryRouter initialEntries={["/feats"]}>
      <Routes>
        <Route path="/feats" element={<DHFeatsPage />} />
        <Route
          path="*"
          element={
            <div>
              <p>Feature destination</p>
              <DHScoreCard />
            </div>
          }
        />
      </Routes>
      <Toaster />
    </MemoryRouter>
  </QueryClientProvider>,
);
