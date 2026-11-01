/* eslint-disable react-refresh/only-export-components -- Standalone browser fixture entry point. */
// Production screens and fonts; only identity and backend transport are substituted.
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
import ShowdownPage from '../../src/pages/ShowdownPage';
import ShowdownMatchPage from '../../src/pages/ShowdownMatchPage';
import CipherCreatePage from '../../src/pages/CipherCreatePage';
import library from '../../supabase/seed/prism-break-library.json';
import afterimageLibrary from '../../supabase/seed/afterimage-library.json';
import type { AfterimageSceneDefinition } from '../../src/lib/showdown/afterimage/types';
import type { PrismPuzzle } from '../../src/lib/showdown/prism/types';
import { showdownFixture } from './showdown-backend';

const params = new URLSearchParams(location.search);
const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
const catalog = library.map(entry => {
  const { minimumRotations, title, validation: _validation, ...puzzle } = entry;
  return { puzzle: puzzle as PrismPuzzle, title, minimum_rotations: minimumRotations };
});
showdownFixture.installLibrary(catalog);
showdownFixture.installCipherGame();
showdownFixture.installAfterimageLibrary(afterimageLibrary.map(entry => {
  const { validation: _validation, ...scene } = entry;
  return scene as AfterimageSceneDefinition;
}));
Object.assign(window, { showdownQueryClient: client });
function RouteProbe() {
  const route = useLocation(), navigate = useNavigate();
  useEffect(() => {
    Object.assign(window, { showdownNavigate: navigate, showdownReady: true });
    const next = new URLSearchParams(location.search);
    next.set('route', route.pathname + route.search);
    history.replaceState(null, '', location.pathname + '?' + next);
  }, [route.pathname, route.search, navigate]);
  return <span hidden data-qa-route={route.pathname + route.search} />;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={client}>
  <ThemeProvider attribute="class" forcedTheme={params.get('theme') || 'dark'} enableSystem={false}>
    <MemoryRouter initialEntries={[params.get('route') || '/showdown?game=cipher_duel']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <RouteProbe />
      <Routes>
        <Route path="/showdown" element={<ShowdownPage />} />
        <Route path="/showdown/cipher/new" element={<CipherCreatePage />} />
        <Route path="/showdown/:challengeId" element={<ShowdownMatchPage />} />
        <Route path="/compete" element={<main><h1>Compete</h1><a href="/showdown">DH Showdown</a></main>} />
        <Route path="*" element={<main><h1>Route unavailable</h1></main>} />
      </Routes>
    </MemoryRouter>
  </ThemeProvider>
</QueryClientProvider></React.StrictMode>);
