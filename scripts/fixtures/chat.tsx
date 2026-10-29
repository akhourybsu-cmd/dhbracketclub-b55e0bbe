// Production chat and app shell. Browser QA substitutes only isolated data.
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AppLayout } from "../../src/components/AppLayout";
import ChatPage from "../../src/pages/ChatPage";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "../../src/index.css";
const params = new URLSearchParams(location.search);
createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" forcedTheme={params.get("theme") || "dark"}>
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter
        initialEntries={[
          "/chat" +
            (params.has("channel") ? "?channel=" + params.get("channel") : ""),
        ]}
      >
        <AppLayout>
          <Routes>
            <Route path="/chat" element={<ChatPage />} />
            <Route path="*" element={<h1>Chat closed</h1>} />
          </Routes>
        </AppLayout>
        <Toaster />
      </MemoryRouter>
    </QueryClientProvider>
  </ThemeProvider>,
);
