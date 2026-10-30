import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FindLinkPreview } from "../../src/components/dailyFind/FindLinkPreview";
import "../../src/index.css";
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    <div
      style={{
        maxWidth: 560,
        padding: 16,
        margin: "auto",
        display: "grid",
        gap: 16,
      }}
    >
      <FindLinkPreview url={location.origin + "/clip.webm?one"} />
      <FindLinkPreview url="https://youtu.be/abcdefghijk" />
      <FindLinkPreview url={location.origin + "/clip.webm?two"} />
      <div style={{ height: 1500 }} />
    </div>
  </QueryClientProvider>,
);
