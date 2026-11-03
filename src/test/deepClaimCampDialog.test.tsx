import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DeepClaimPage from '@/pages/DeepClaimPage';
import { continueDeepClaimCompany } from './fixtures/deepClaimTutorialMock';
import type { DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseFourSnapshot } from './fixtures/deepClaimPhase4';

const wire = vi.hoisted(() => ({ data: null as DeepClaimSnapshot | null, readOnly: false, startResearch: vi.fn(), fulfillContract: vi.fn(), claimMilestone: vi.fn(), refresh: vi.fn(), noop: vi.fn(), build: vi.fn(), hire: vi.fn(), stores: vi.fn(), confirmed: vi.fn(), close: vi.fn(), pending: null as string | null }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-a' }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: 'club-a' }, loading: false }) }));
vi.mock('@/hooks/useClubAssets', () => ({ useClubAssets: () => ({ loading: false, isInstalled: () => true }) }));
// Pixel backdrop lifecycle is covered separately; keep these economic suites renderer-free.
vi.mock('@/components/deepClaim/menu/DeepClaimMenuBackdrop', () => ({ DeepClaimMenuBackdrop: () => null }));
vi.mock('@/hooks/useDeepClaimTutorial', async () => ({ useDeepClaimTutorial: (await import('./fixtures/deepClaimTutorialMock')).useDeepClaimTutorialMock }));
vi.mock('@/hooks/useDeepClaim', () => ({ useDeepClaim: () => ({ data: wire.data, loading: false, refreshing: false, error: null, busy: false, readOnly: wire.readOnly, pendingAction: wire.pending, serverNow: () => Date.parse('2026-11-01T12:00:00Z'), refresh: wire.refresh, startResearch: wire.startResearch, fulfillContract: wire.fulfillContract, claimMilestone: wire.claimMilestone, preview: wire.noop, dispatch: wire.noop, resolveDiscovery: wire.noop, hire: wire.noop, train: wire.noop, assignEquipment: wire.noop, repairEquipment: wire.noop, retireEquipment: wire.noop, startProduction: wire.noop, collectProduction: wire.noop, upgrade: wire.noop, retryPending: wire.noop }) }));
vi.mock('@/lib/deepClaim/audio', () => ({ createDeepClaimAudio: () => { const settings = { master: false, music: true, ambient: true, sfx: true, volume: .65 }; return { getSnapshot: () => settings, subscribe: () => () => {}, setScene: vi.fn(), updateSettings: vi.fn(), unlock: vi.fn(), play: vi.fn(), setActive: vi.fn(), dispose: vi.fn() }; } }));

function App() { return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DeepClaimPage /></MemoryRouter>; }
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); wire.data = phaseFourSnapshot(); wire.data.company!.tutorial_used = true;
  wire.readOnly = false; wire.pending = null;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('returns from an Office review and immediately switches away and back without replacing the camera controls', async () => {
  render(<App />); continueDeepClaimCompany();
  const controls = screen.getByRole('group', { name: 'Mine view controls' });
  const cameraTarget = controls.parentElement;
  for (let attempt = 0; attempt < 3; attempt++) {
    fireEvent.click(screen.getByRole('button', { name: 'Open company office' }));
    const office = screen.getByRole('dialog', { name: 'Company Office' });
    fireEvent.click(within(office).getByRole('button', { name: 'Records' }));
    fireEvent.click(within(office).getByRole('button', { name: 'Review milestone First Shift' }));
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Company Office' })).not.toBeInTheDocument());
    const surface = screen.getByRole('tab', { name: 'Surface' }); surface.focus();
    fireEvent.keyDown(surface, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Settings' })).toHaveFocus();
    const hiddenControls = document.querySelector('[aria-label="Mine view controls"]');
    expect(hiddenControls).toBe(controls); expect(hiddenControls?.parentElement).toBe(cameraTarget);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Settings' }), { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Surface' })).toHaveFocus();
    expect(screen.getByRole('group', { name: 'Mine view controls' })).toBe(controls);
  }
  fireEvent.click(screen.getByRole('tab', { name: 'Mine' }));
  expect(screen.getByRole('group', { name: 'Mine view controls' })).toBe(controls);
  expect(controls.parentElement).toBe(cameraTarget);
});
