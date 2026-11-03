import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimBusiness, type ClaimBusinessView } from '@/components/deepClaim/DeepClaimBusiness';
import { DeepClaimSettings } from '@/components/deepClaim/DeepClaimSettings';
import type { DeepClaimAudio, DeepClaimAudioSettings } from '@/lib/deepClaim/audio';
import type { DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseFourSnapshot } from './fixtures/deepClaimPhase4';

const wire = vi.hoisted(() => ({ update: vi.fn(), refresh: vi.fn(), error: null as string | null, loading: false, saving: false }));
vi.mock('@/hooks/useNotificationPreferences', () => ({ useNotificationPreferences: () => ({ prefs: { deep_claim: true }, ...wire }) }));
const actions = { startResearch: vi.fn(), fulfillContract: vi.fn(), claimMilestone: vi.fn() };
const noop = () => {};
beforeEach(() => { vi.clearAllMocks(); wire.error = null; wire.loading = false; wire.saving = false; wire.update.mockResolvedValue(undefined); wire.refresh.mockResolvedValue(undefined); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
function Office({ data, initialView }: { data: DeepClaimSnapshot; initialView: ClaimBusinessView }) {
  const [view, setView] = useState(initialView);
  return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DeepClaimBusiness snapshot={data} view={view} onView={setView} onClose={noop} onBuild={noop} onHire={noop} onStores={noop} actions={actions} onConfirmed={noop} now={Date.parse(data.server_now)} onRefresh={noop} busy={false} readOnly={false} /></MemoryRouter>;
}
function openUpdates() {
  const value: DeepClaimAudioSettings = { master: false, music: true, sfx: true, ambient: true, volume: .65, musicVolume: 1, ambientVolume: 1, sfxVolume: 1 };
  const audio = { getSnapshot: () => value, subscribe: () => noop, updateSettings: noop, unlock: async () => true } as unknown as DeepClaimAudio;
  const ui = render(<DeepClaimSettings audio={audio} visuals={{ reducedGraphics: false, reducedMotion: false }} onVisualsChange={noop} onRefresh={noop} refreshing={false} business />);
  const sound = screen.getByRole('tab', { name: 'Sound' }); sound.focus(); fireEvent.keyDown(sound, { key: 'End' });
  expect(screen.getByRole('tab', { name: 'Updates' })).toHaveFocus();
  return ui;
}

describe('Deep Claim Office reading position and keyboard focus', () => {
  it.each([
    ['research', 'Research', /^Review (?!order|milestone)/],
    ['contracts', 'Contracts', /^Review order /],
    ['records', 'Records', /^Review milestone /],
  ] as const)('restores the %s list and its actual opener after inspecting a lower card', (view, name, label) => {
    const data = phaseFourSnapshot(), original = structuredClone(data);
    render(<Office data={data} initialView={view} />);
    const list = screen.getByRole('region', { name: `${name} options` }); list.scrollTop = 310;
    const openers = within(list).getAllByRole('button', { name: label }), opener = openers.at(-1)!;
    const openerName = opener.getAttribute('aria-label')!;
    opener.focus(); fireEvent.click(opener);
    expect(screen.getByRole('region', { name: `${name} details` }).scrollTop).toBe(0);
    const back = screen.getByRole('button', { name: 'Back' }); back.focus(); fireEvent.click(back);
    expect(screen.getByRole('region', { name: `${name} options` }).scrollTop).toBe(310);
    expect(screen.getByRole('button', { name: openerName })).toHaveFocus();
    expect(data).toEqual(original);
    Object.values(actions).forEach(action => expect(action).not.toHaveBeenCalled());
  });

  it('reveals the first new contract page and preserves its read-only navigation', () => {
    const data = phaseFourSnapshot();
    render(<Office data={data} initialView="contracts" />);
    const region = screen.getByRole('region', { name: 'Contracts options' }); region.scrollTop = 400;
    const next = screen.getByRole('button', { name: 'Next orders page' }); next.focus(); fireEvent.click(next);
    expect(region.scrollTop).toBe(0);
    expect(screen.getByRole('heading', { name: data.business_catalog!.contracts[4].name })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Previous orders page' })).toBeEnabled();
    region.scrollTop = 400;
    fireEvent.click(screen.getByRole('button', { name: 'Previous orders page' }));
    expect(region.scrollTop).toBe(0);
    expect(screen.getByRole('heading', { name: data.business_catalog!.contracts[0].name })).toHaveFocus();
    expect(actions.fulfillContract).not.toHaveBeenCalled();
  });

  it('moves to the first selected research card even when reselecting the same branch', () => {
    const data = phaseFourSnapshot();
    render(<Office data={data} initialView="research" />);
    const region = screen.getByRole('region', { name: 'Research options' }); region.scrollTop = 250;
    const branch = screen.getByRole('button', { name: /^Geology:/ }); branch.focus(); fireEvent.click(branch);
    const first = data.business_catalog!.research.find(item => item.branch === 'geology')!;
    expect(screen.getByRole('heading', { name: first.name })).toHaveFocus();
    expect(branch).toHaveAttribute('aria-pressed', 'true');
    expect(region.scrollTop).toBe(0);
    region.scrollTop = 250;
    fireEvent.click(branch);
    expect(region.scrollTop).toBe(0);
    expect(screen.getByRole('heading', { name: first.name })).toHaveFocus();
    expect(actions.startResearch).not.toHaveBeenCalled();
  });

  it('falls back to the current options when a refreshed catalog removes the reviewed card', () => {
    const data = phaseFourSnapshot(), ui = render(<Office data={data} initialView="contracts" />);
    const last = data.business_catalog!.contracts[3];
    const region = screen.getByRole('region', { name: 'Contracts options' }); region.scrollTop = 200;
    fireEvent.click(screen.getByRole('button', { name: `Review order ${last.name}` }));
    const updated = { ...data, revision: data.revision + 1, business_catalog: { ...data.business_catalog!, contracts: data.business_catalog!.contracts.filter(item => item.key !== last.key) } };
    ui.rerender(<Office data={updated} initialView="contracts" />);
    expect(screen.getByRole('region', { name: 'Contracts options' })).toHaveFocus();
    expect(screen.getByRole('region', { name: 'Contracts options' }).scrollTop).toBe(0);
    expect(screen.queryByRole('button', { name: 'Deliver whole order' })).not.toBeInTheDocument();
  });

  it('scrolls only the Office region when a restored opener needs revealing after layout changes', () => {
    const data = phaseFourSnapshot();
    render(<Office data={data} initialView="contracts" />);
    const region = screen.getByRole('region', { name: 'Contracts options' }), opener = screen.getByRole('button', { name: `Review order ${data.business_catalog!.contracts[3].name}` });
    const name = opener.getAttribute('aria-label');
    const rectangle = (top: number, bottom: number) => ({ top, bottom, height: bottom - top, left: 0, right: 300, width: 300, x: 0, y: top, toJSON: () => ({}) });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('dcl-business-body') ? rectangle(100, 200) : this.getAttribute('aria-label') === name ? rectangle(260, 304) : rectangle(0, 0);
    });
    const windowScroll = vi.spyOn(window, 'scrollTo').mockImplementation(noop);
    region.scrollTop = 200; opener.focus(); fireEvent.click(opener);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(region.scrollTop).toBe(310);
    expect(screen.getByRole('button', { name: name! })).toHaveFocus();
    expect(windowScroll).not.toHaveBeenCalled();
  });
});

describe('Deep Claim notification menu recovery', () => {
  it('clears a failed save after a successful explicit retry and prevents duplicate refreshes', async () => {
    wire.update.mockRejectedValueOnce(new Error('The preference save was interrupted.'));
    const refresh = deferred(); wire.refresh.mockReturnValue(refresh.promise);
    openUpdates();
    fireEvent.click(screen.getByRole('switch', { name: 'Deep Claim notifications' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The preference save was interrupted.');
    const retry = screen.getByRole('button', { name: 'Retry notification preferences' }); retry.focus(); fireEvent.click(retry); fireEvent.click(retry);
    expect(wire.refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Refreshing preferences…');
    expect(retry).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('switch', { name: 'Deep Claim notifications' })).toBeDisabled();
    await act(async () => refresh.resolve());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry notification preferences' })).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Deep Claim notifications' })).toBeEnabled();
    expect(wire.update).toHaveBeenCalledOnce();
  });

  it('replaces an old local failure with the current retry error and permits another retry', async () => {
    wire.update.mockRejectedValueOnce(new Error('Old save error'));
    wire.refresh.mockRejectedValueOnce(new Error('Still offline'));
    openUpdates(); fireEvent.click(screen.getByRole('switch', { name: 'Deep Claim notifications' }));
    await screen.findByText('Old save error');
    fireEvent.click(screen.getByRole('button', { name: 'Retry notification preferences' }));
    expect(await screen.findByText('Still offline')).toHaveAttribute('role', 'alert');
    expect(screen.queryByText('Old save error')).not.toBeInTheDocument();
    const retry = screen.getByRole('button', { name: 'Retry notification preferences' });
    expect(retry).toBeEnabled(); fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(wire.refresh).toHaveBeenCalledTimes(2);
  });

  it('continues showing a fresh hook error instead of a previous local save failure', async () => {
    wire.update.mockRejectedValueOnce(new Error('Old save error'));
    wire.refresh.mockImplementationOnce(async () => { wire.error = 'The current preferences could not load.'; });
    openUpdates(); fireEvent.click(screen.getByRole('switch', { name: 'Deep Claim notifications' }));
    await screen.findByText('Old save error');
    fireEvent.click(screen.getByRole('button', { name: 'Retry notification preferences' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The current preferences could not load.');
    expect(screen.queryByText('Old save error')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry notification preferences' })).toBeEnabled();
  });
});
