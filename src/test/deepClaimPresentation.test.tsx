import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StrictMode, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DeepClaimPage from '@/pages/DeepClaimPage';
import { continueDeepClaimCompany } from './fixtures/deepClaimTutorialMock';
import { ClaimDialog, ClaimDialogScope } from '@/components/deepClaim/DeepClaimPrimitives';
import { DeepClaimSettings } from '@/components/deepClaim/DeepClaimSettings';
import { discoveryRevealKey, markDiscoveryRevealed, nextDiscoveryReveal, observeDiscoveryReveals, readDiscoveryReveals, saveDiscoveryReveals } from '@/components/deepClaim/discoveryReveals';
import type { DeepClaimDiscovery, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import type { createDeepClaimAudio } from '@/lib/deepClaim/audio';
import { phaseThreeSnapshot } from './fixtures/deepClaimPhase3';

const wire = vi.hoisted(() => ({ data: null as DeepClaimSnapshot | null, userId: 'player', clubId: 'club', readOnly: false, update: vi.fn(), unlock: vi.fn(), pause: vi.fn(), play: vi.fn(), resolve: vi.fn(), refresh: vi.fn(), controllers: [] as { disposed: boolean; started: boolean }[] }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: wire.userId }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: wire.clubId }, loading: false }) }));
vi.mock('@/hooks/useClubAssets', () => ({ useClubAssets: () => ({ loading: false, isInstalled: () => true }) }));
vi.mock('@/hooks/useNotificationPreferences', () => ({ useNotificationPreferences: () => ({ prefs: { deep_claim: true }, loading: false, saving: false, error: null, update: vi.fn(), refresh: vi.fn() }) }));
// Pixel backdrop lifecycle is covered separately; keep these economic suites renderer-free.
vi.mock('@/components/deepClaim/menu/DeepClaimMenuBackdrop', () => ({ DeepClaimMenuBackdrop: () => null }));
vi.mock('@/hooks/useDeepClaimTutorial', async () => ({ useDeepClaimTutorial: (await import('./fixtures/deepClaimTutorialMock')).useDeepClaimTutorialMock }));
vi.mock('@/hooks/useDeepClaim', () => ({ useDeepClaim: () => ({ data: wire.data, readOnly: wire.readOnly, busy: false, refreshing: false, error: null, pendingAction: null, serverNow: () => Date.parse(wire.data!.server_now), refresh: wire.refresh, resolveDiscovery: wire.resolve }) }));
vi.mock('@/components/deepClaim/renderer/DeepClaimCanvas', () => ({ DeepClaimCanvas: ({ active }: { active: boolean }) => <div data-testid="claim-canvas" data-active={active} /> }));
vi.mock('@/lib/deepClaim/audio', () => ({ createDeepClaimAudio: () => { const value = { master: false, music: true, sfx: true, ambient: true, volume: .65, musicVolume: 1, ambientVolume: 1, sfxVolume: 1 }; const controller = { disposed: false, started: false, getSnapshot: () => value, subscribe: () => () => {}, setScene: vi.fn(), updateSettings: wire.update, unlock: async () => { if (controller.disposed) return false; controller.started = true; return wire.unlock(); }, setBackgroundPaused: wire.pause, play: wire.play, dispose: () => { controller.disposed = true; } }; wire.controllers.push(controller); return controller; } }));
function find(overrides: Partial<DeepClaimDiscovery> = {}): DeepClaimDiscovery { return { id: 'new-find', job_id: 'shift', kind: 'banded_geode', name: 'Banded Geode', quality: 'fine', detail: 'Pale quartz bands, confirmed by the returning crew.', sale_value: 42, salvage: { quartz: 2 }, x: 47, y: 3, status: 'pending', discovered_at: '2026-11-01T12:01:00Z', resolved_at: null, ...overrides }; }
function App() { return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DeepClaimPage /></MemoryRouter>; }
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); wire.data = phaseThreeSnapshot(); wire.data.server_now = '2026-11-01T12:00:00Z'; wire.readOnly = false; wire.userId = 'player'; wire.clubId = 'club'; wire.controllers = []; wire.unlock.mockResolvedValue(true); });
afterEach(cleanup);

describe('Source-backed rare-find presentation receipts', () => {
  it('quietly baselines historical finds then orders only new pending rare finds by quality', () => {
    const historic = find({ id: 'old', discovered_at: '2026-10-01T12:00:00Z' });
    const baseline = observeDiscoveryReveals(null, [historic], '2026-11-01T12:00:00Z');
    expect(nextDiscoveryReveal(baseline, [historic])).toBeNull();
    const common = find({ id: 'common', quality: 'common' });
    const flawless = find({ id: 'flawless', quality: 'flawless' });
    const value = observeDiscoveryReveals(baseline, [historic, common, find(), flawless], '2026-11-01T12:02:00Z');
    expect(value.pending).toEqual(['new-find', 'flawless']); expect(nextDiscoveryReveal(value, [find(), flawless])?.id).toBe('flawless');
  });
  it('persists only scoped IDs and server watermark, survives reload, and removes resolved pending finds', () => {
    const key = discoveryRevealKey('a', 'club', 'company');
    const baseline = observeDiscoveryReveals(null, [], '2026-11-01T12:00:00Z');
    const pending = observeDiscoveryReveals(baseline, [find()], '2026-11-01T12:01:00Z');
    saveDiscoveryReveals(key, pending); expect(nextDiscoveryReveal(readDiscoveryReveals(key)!, [find()])?.id).toBe('new-find');
    const shown = markDiscoveryRevealed(pending, 'new-find', [find()]); saveDiscoveryReveals(key, shown);
    expect(nextDiscoveryReveal(observeDiscoveryReveals(readDiscoveryReveals(key), [find()], '2026-11-01T12:02:00Z'), [find()])).toBeNull();
    expect(JSON.parse(localStorage.getItem(key)!)).not.toHaveProperty('sale_value');
    expect(readDiscoveryReveals(discoveryRevealKey('b', 'club', 'company'))).toBeNull();
    expect(readDiscoveryReveals(discoveryRevealKey('a', 'other-club', 'company'))).toBeNull();
    expect(observeDiscoveryReveals(pending, [find({ status: 'kept' })], '2026-11-01T12:02:00Z').pending).toEqual([]);
  });
  it('retains dismissed pending IDs after more than 128 later reveals', () => {
    const old = find({ id: 'still-pending' }); let receipt = observeDiscoveryReveals(null, [], '2026-11-01T12:00:00Z');
    receipt = markDiscoveryRevealed(receipt, old.id, [old]);
    for (let index = 0; index < 150; index++) { const current = find({ id: `later-${index}` }); receipt = markDiscoveryRevealed(receipt, current.id, [old, current]); }
    expect(receipt.seen).toHaveLength(128); expect(receipt.seen).toContain(old.id);
    expect(observeDiscoveryReveals(receipt, [old], '2026-11-01T12:02:00Z').pending).toEqual([]);
  });
  it('rejects corrupt receipts and admits a new find at the same server timestamp without replaying old IDs', () => {
    localStorage.setItem('bad', '{'); expect(readDiscoveryReveals('bad')).toBeNull();
    const baseline = observeDiscoveryReveals(null, [find({ id: 'old' })], '2026-11-01T12:01:00Z');
    expect(observeDiscoveryReveals(baseline, [find({ id: 'old' }), find()], '2026-11-01T12:01:00Z').pending).toEqual(['new-find']);
  });
});

describe('Camp settings and guide navigation', () => {
  function Settings() { const value = { master: false, music: true, ambient: true, sfx: true, volume: .65, musicVolume: 1, ambientVolume: 1, sfxVolume: 1 }; const audio = { getSnapshot: () => value, subscribe: () => () => {}, setScene: vi.fn(), updateSettings: wire.update, unlock: wire.unlock } as unknown as ReturnType<typeof createDeepClaimAudio>; return <DeepClaimSettings audio={audio} visuals={{ reducedGraphics: false, reducedMotion: false }} onVisualsChange={wire.update} onRefresh={wire.refresh} refreshing={false} industry field business />; }
  it('keeps sound opt-in and three independent mix controls without changing other buses', async () => {
    render(<Settings />); expect(wire.unlock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('slider', { name: 'Music volume' }), { target: { value: '35' } });
    expect(wire.update).toHaveBeenLastCalledWith({ musicVolume: .35 }); expect(wire.unlock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('slider', { name: 'Mining effects volume' }), { target: { value: '50' } }); expect(wire.update).toHaveBeenLastCalledWith({ sfxVolume: .5 });
    fireEvent.change(screen.getByRole('slider', { name: 'Camp ambience volume' }), { target: { value: '25' } }); expect(wire.update).toHaveBeenLastCalledWith({ ambientVolume: .25 });
    fireEvent.click(screen.getByRole('switch', { name: 'Enable sound' })); await waitFor(() => expect(wire.unlock).toHaveBeenCalledOnce());
  });
  it('uses a keyboard-operable compact settings selector and loads actual notification controls on Updates', () => {
    render(<Settings />); const sound = screen.getByRole('tab', { name: 'Sound' }); sound.focus(); fireEvent.keyDown(sound, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Visuals' })).toHaveFocus(); expect(screen.getByRole('switch', { name: 'Reduced motion' })).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument(); fireEvent.keyDown(screen.getByRole('tab', { name: 'Visuals' }), { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Updates' })).toHaveFocus(); expect(screen.getByRole('switch', { name: 'Deep Claim notifications' })).toBeInTheDocument();
  });
  it('presents one guide chapter at a time and focuses the new page heading', () => {
    render(<Settings />); fireEvent.click(screen.getByRole('button', { name: 'Field guide' })); const guide = screen.getByRole('dialog', { name: 'Field guide' });
    expect(within(guide).getByRole('heading', { name: 'Exploration' })).toBeInTheDocument(); expect(within(guide).queryByRole('heading', { name: 'Extraction' })).not.toBeInTheDocument();
    expect(within(guide).getByRole('button', { name: 'Previous guide page' })).toBeDisabled(); fireEvent.click(within(guide).getByRole('button', { name: 'Next guide page' }));
    expect(within(guide).getByRole('heading', { name: 'Extraction' })).toHaveFocus(); expect(within(guide).getByRole('status')).toHaveTextContent('Page 2 of 13');
  });
});

describe('Dialog focus and scene suspension', () => {
  it('keeps its owned audio alive through StrictMode replay and disposes the old controller on account change and real unmount', async () => {
    const view = render(<StrictMode><App /></StrictMode>); continueDeepClaimCompany(); await Promise.resolve();
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' })); fireEvent.click(screen.getByRole('switch', { name: 'Enable sound' }));
    await waitFor(() => expect(wire.unlock).toHaveBeenCalledTimes(2)); const first = wire.controllers.find(controller => controller.started)!; expect(first.disposed).toBe(false);
    wire.userId = 'next-player'; wire.data = { ...phaseThreeSnapshot(), company: { ...wire.data!.company!, id: 'next-company', user_id: wire.userId } }; view.rerender(<StrictMode><App /></StrictMode>);
    await waitFor(() => expect(first.disposed).toBe(true)); continueDeepClaimCompany(); fireEvent.click(screen.getByRole('tab', { name: 'Settings' })); fireEvent.click(screen.getByRole('switch', { name: 'Enable sound' }));
    await waitFor(() => expect(wire.unlock).toHaveBeenCalledTimes(4)); const second = wire.controllers.find(controller => controller.started && controller !== first)!; expect(second.disposed).toBe(false);
    view.unmount(); await Promise.resolve(); expect(second.disposed).toBe(true);
  });
  it('focuses a readable dialog heading and restores the explicit opener on close', async () => {
    function DialogHarness() { const [open, setOpen] = useState(false); return <><button onClick={() => setOpen(true)}>Open supplies</button><ClaimDialog open={open} onClose={() => setOpen(false)} title="Supplies"><button onClick={() => setOpen(false)}>Done</button></ClaimDialog></>; }
    render(<DialogHarness />); const opener = screen.getByRole('button', { name: 'Open supplies' }); opener.focus(); fireEvent.click(opener);
    expect(screen.getByRole('heading', { name: 'Supplies' })).toHaveFocus(); fireEvent.click(screen.getByRole('button', { name: 'Done' })); await waitFor(() => expect(opener).toHaveFocus());
  });
  it('tracks nested dialogs and releases suspension only after the final one closes', () => {
    const onOpen = vi.fn(); const view = render(<ClaimDialogScope onOpenChange={onOpen}><ClaimDialog open onClose={() => {}} title="First"><p>First</p></ClaimDialog><ClaimDialog open onClose={() => {}} title="Second"><p>Second</p></ClaimDialog></ClaimDialogScope>);
    expect(onOpen).toHaveBeenLastCalledWith(true); view.rerender(<ClaimDialogScope onOpenChange={onOpen}><ClaimDialog open={false} onClose={() => {}} title="First"><p>First</p></ClaimDialog><ClaimDialog open onClose={() => {}} title="Second"><p>Second</p></ClaimDialog></ClaimDialogScope>); expect(onOpen).toHaveBeenLastCalledWith(true);
    view.unmount(); expect(onOpen).toHaveBeenLastCalledWith(false);
  });
  it('reveals a new authoritative rare find once and permits only manual inspection or dismissal', async () => {
    const view = render(<App />); continueDeepClaimCompany(); expect(screen.queryByRole('dialog', { name: 'A find from the deep' })).not.toBeInTheDocument();
    wire.data = { ...wire.data!, revision: 4, server_now: '2026-11-01T12:02:00Z', discoveries: [find()], discovery_summary: { pending: 1, kept: 0, sold: 0, salvaged: 0 } }; view.rerender(<App />);
    const reveal = await screen.findByRole('dialog', { name: 'A find from the deep' }); expect(reveal).toHaveTextContent('Banded Geode'); expect(screen.getByTestId('claim-canvas')).toHaveAttribute('data-active', 'false'); expect(wire.pause).toHaveBeenLastCalledWith(true); expect(wire.resolve).not.toHaveBeenCalled();
    fireEvent.click(within(reveal).getByRole('button', { name: 'Inspect find' })); const decision = await screen.findByRole('dialog', { name: 'Banded Geode' }); expect(within(decision).getByRole('button', { name: /^Keep in cabinet/ })).toBeInTheDocument(); expect(wire.resolve).not.toHaveBeenCalled();
  });
  it.each(['account', 'club'] as const)('clears an open private reveal across a %s switch', boundary => {
    const view = render(<App />); continueDeepClaimCompany(); wire.data = { ...wire.data!, revision: 4, discoveries: [find()] }; view.rerender(<App />);
    expect(screen.getByRole('dialog', { name: 'A find from the deep' })).toBeInTheDocument();
    if (boundary === 'account') wire.userId = 'another-player'; else wire.clubId = 'another-club';
    wire.data = { ...phaseThreeSnapshot(), company: { ...wire.data.company!, id: `company-${boundary}`, user_id: wire.userId, club_id: wire.clubId } }; view.rerender(<App />);
    expect(screen.queryByRole('dialog', { name: 'A find from the deep' })).not.toBeInTheDocument(); expect(screen.queryByText('Pale quartz bands, confirmed by the returning crew.')).not.toBeInTheDocument();
  });
  it('drops an open reveal when the authoritative company changes in the same mounted page', () => {
    const view = render(<App />); continueDeepClaimCompany(); wire.data = { ...wire.data!, revision: 4, discoveries: [find()] }; view.rerender(<App />);
    expect(screen.getByRole('dialog', { name: 'A find from the deep' })).toBeInTheDocument();
    wire.data = { ...phaseThreeSnapshot(), company: { ...wire.data.company!, id: 'different-company', name: 'New company' } }; view.rerender(<App />);
    expect(screen.queryByRole('dialog', { name: 'A find from the deep' })).not.toBeInTheDocument(); expect(screen.queryByText('Pale quartz bands, confirmed by the returning crew.')).not.toBeInTheDocument();
  });
  it('never presents old finds on first hydration or new finds while cached read-only', () => {
    wire.data!.discoveries = [find({ id: 'old-find', discovered_at: '2026-10-01T12:00:00Z' })]; const view = render(<App />); continueDeepClaimCompany(); expect(screen.queryByRole('dialog', { name: 'A find from the deep' })).not.toBeInTheDocument();
    wire.readOnly = true; wire.data = { ...wire.data!, revision: 4, discoveries: [...wire.data!.discoveries!, find()] }; view.rerender(<App />); expect(screen.queryByRole('dialog', { name: 'A find from the deep' })).not.toBeInTheDocument();
    wire.readOnly = false; view.rerender(<App />); expect(screen.getByRole('dialog', { name: 'A find from the deep' })).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Later' })); expect(wire.resolve).not.toHaveBeenCalled(); expect(screen.getByTestId('claim-canvas')).toHaveAttribute('data-active', 'true');
  });
});
