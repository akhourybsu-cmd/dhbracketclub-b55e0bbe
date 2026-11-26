/* eslint-disable react-refresh/only-export-components -- Isolated browser fixture, not production navigation. */
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/700.css';
import '../../src/index.css';
import React, { Suspense, lazy, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { getMap, getVisibleObjects, canWalk, createNewSave, getObjective, getQuestSteps } from '../../src/lib/mesomon/engine';
import { readingVoice } from '../../src/lib/mesomon/reading';
import { WALK_STEP_MS } from '../../src/lib/mesomon/input';
import { readLocalSave } from '../../src/lib/mesomon/storage';

const MesomonPage = lazy(() => import('../../src/pages/MesomonPage'));
const params = new URLSearchParams(location.search);
const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
function CurrentRoute() {
  const route = useLocation();
  useEffect(() => {
    const user = params.get('guest') === '1' ? null : '11111111-1111-4111-8111-111111111111';
    Object.assign(window, { mmQa: { getMap, getVisibleObjects, canWalk, createNewSave, getObjective, getQuestSteps, readingVoice, walkStepMs: WALK_STEP_MS, readSave: async () => (await readLocalSave(user, 1))?.save || null } });
    return () => { Reflect.deleteProperty(window, 'mmQa'); };
  }, []);
  return <span hidden data-qa-route={route.pathname} />;
}
function Outside() {
  return <main className="member-page" style={{ minHeight: '180vh' }}><h1>DH Club destination</h1><Link to="/mesomon">Enter Mesomon</Link><p>Ordinary application scrolling remains available here.</p><div style={{ height: '110vh' }} /><button type="button">Outside lower control</button></main>;
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme={params.get('theme') || 'dark'} enableSystem={false} storageKey="mesomon-qa-theme">
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[params.get('route') || '/mesomon']}>
          <CurrentRoute />
          <Suspense fallback={<p role="status">Loading Mesomon</p>}>
            <Routes><Route path="/mesomon" element={<MesomonPage />} /><Route path="*" element={<Outside />} /></Routes>
          </Suspense>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
