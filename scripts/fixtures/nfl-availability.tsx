// Local visual fixture only. The production entrypoint never imports this file.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CrazyChainPage from '../../src/pages/CrazyChainPage';
import '../../src/index.css';

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter initialEntries={['/nfl/crazy-chain?week=1']}>
      <main className="mx-auto max-w-3xl p-4"><CrazyChainPage /></main>
    </MemoryRouter>
  </QueryClientProvider>,
);
