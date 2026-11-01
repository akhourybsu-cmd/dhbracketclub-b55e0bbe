/* eslint-disable react-refresh/only-export-components -- Standalone browser fixture. */
import '@fontsource/sora/600.css';
import '@fontsource/sora/700.css';
import '@fontsource/sora/800.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/work-sans/400.css';
import '@fontsource/work-sans/500.css';
import '@fontsource/work-sans/600.css';
import '@fontsource/work-sans/700.css';
import '../../src/index.css';
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import DeepClaimPage from '../../src/pages/DeepClaimPage';
import { deepClaimFixture } from './deep-claim-transport';
import { DeepClaimRuntimeVisual } from './deep-claim-runtime';

const parameters = new URLSearchParams(location.search);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
Object.assign(window, { deepClaimQueryClient: queryClient, deepClaimQa: deepClaimFixture });
function RouteProbe() {
  const route = useLocation(), navigate = useNavigate();
  useEffect(() => { Object.assign(window, { deepClaimNavigate: navigate, deepClaimReady: true }); }, [navigate]);
  return <span hidden data-qa-route={route.pathname + route.search} />;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}>
  <ThemeProvider attribute="class" forcedTheme={parameters.get('theme') || 'dark'} enableSystem={false}>
    <MemoryRouter initialEntries={[parameters.get('route') || '/deep-claim']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <RouteProbe />
      <Routes>
        <Route path="/deep-claim/render-stress" element={<DeepClaimRuntimeVisual />} />
        <Route path="/deep-claim" element={<DeepClaimPage />} />
        <Route path="/compete" element={<main><h1>Compete</h1><a href="/deep-claim">Deep Claim</a></main>} />
        <Route path="*" element={<main><h1>Route unavailable</h1></main>} />
      </Routes>
    </MemoryRouter>
  </ThemeProvider>
</QueryClientProvider></React.StrictMode>);
