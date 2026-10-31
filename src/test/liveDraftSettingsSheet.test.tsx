import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveDraftSettingsSheet } from '@/components/draft/live/LiveDraftSettingsSheet';
import { DEFAULT_LIVE_SETTINGS, type LiveDraftSettings } from '@/lib/draft/liveDraft';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function Harness({ save, settings = DEFAULT_LIVE_SETTINGS }: {
  save: (patch: Partial<LiveDraftSettings>) => Promise<void> | void;
  settings?: LiveDraftSettings;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)}>Open settings</button>
    <button type="button">Outside action</button>
    <LiveDraftSettingsSheet open={open} onClose={() => setOpen(false)} settings={settings} onSave={save} />
  </>;
}

async function openSettings() {
  const launcher = screen.getByRole('button', { name: 'Open settings' });
  launcher.focus();
  fireEvent.click(launcher);
  const dialog = await screen.findByRole('dialog', { name: 'Room Settings' });
  return { launcher, dialog };
}

describe('Live draft settings dialog', () => {
  it('contains focus, cancels with Escape without saving, and restores the host trigger', async () => {
    const save = vi.fn();
    render(<Harness save={save} />);
    const outside = screen.getByRole('button', { name: 'Outside action' });
    const { launcher, dialog } = await openSettings();
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Close settings' })).toHaveFocus());
    act(() => outside.focus());
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.click(within(dialog).getByRole('button', { name: '3m' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(launcher).toHaveFocus());
    expect(save).not.toHaveBeenCalled();
    const reopened = (await openSettings()).dialog;
    expect(within(reopened).getByRole('button', { name: '1.5m' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('retains all settings and the exact clock/expiry values through a failed save and retry', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    const { rerender } = render(<Harness save={save} />);
    const { dialog } = await openSettings();
    expect(within(dialog).getAllByRole('switch')).toHaveLength(7);
    fireEvent.click(within(dialog).getByRole('button', { name: '3m' }));
    fireEvent.click(within(dialog).getByRole('button', { name: /^Auto-skip the pick/ }));
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Announce each pick on the big screen' }));
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Kiosk sound effects' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Settings' }));
    await screen.findByRole('alert');
    rerender(<Harness save={save} settings={{ ...DEFAULT_LIVE_SETTINGS }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Settings could not be saved. Try again.');
    expect(screen.getByRole('dialog', { name: 'Room Settings' })).toBeVisible();
    expect(within(dialog).getByRole('button', { name: '3m' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByRole('switch', { name: 'Kiosk sound effects' })).toHaveAttribute('aria-checked', 'false');
    const expected = { ...DEFAULT_LIVE_SETTINGS, pickSeconds: 180, timeoutBehavior: 'auto_skip', announce: false, sound: false };
    expect(save).toHaveBeenNthCalledWith(1, expected);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Settings' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(save).toHaveBeenNthCalledWith(2, expected);
  });

  it('keeps unsaved edits across unchanged persisted settings and replacement realtime objects', async () => {
    const save = vi.fn();
    const { rerender } = render(<Harness save={save} />);
    const { dialog } = await openSettings();
    fireEvent.click(within(dialog).getByRole('button', { name: '3m' }));
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Kiosk sound effects' }));

    for (const settings of [DEFAULT_LIVE_SETTINGS, { ...DEFAULT_LIVE_SETTINGS }]) {
      rerender(<Harness save={save} settings={settings} />);
      expect(within(dialog).getByRole('button', { name: '3m' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(dialog).getByRole('switch', { name: 'Kiosk sound effects' })).toHaveAttribute('aria-checked', 'false');
      expect(within(dialog).queryByRole('status')).not.toBeInTheDocument();
      expect(save).not.toHaveBeenCalled();
    }

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Settings' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(save).toHaveBeenCalledExactlyOnceWith({ ...DEFAULT_LIVE_SETTINGS, pickSeconds: 180, sound: false });
  });

  it('retains choices when another host changes saved values and seeds the latest values on reopening', async () => {
    const save = vi.fn();
    const { rerender } = render(<Harness save={save} />);
    const { dialog } = await openSettings();
    fireEvent.click(within(dialog).getByRole('button', { name: '3m' }));
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Kiosk sound effects' }));
    const latest = { ...DEFAULT_LIVE_SETTINGS, pickSeconds: 60, announce: false };

    rerender(<Harness save={save} settings={latest} />);
    expect(within(dialog).getByRole('button', { name: '3m' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByRole('switch', { name: 'Kiosk sound effects' })).toHaveAttribute('aria-checked', 'false');
    expect(within(dialog).getByRole('switch', { name: 'Announce each pick on the big screen' })).toHaveAttribute('aria-checked', 'true');
    expect(within(dialog).getByRole('status')).toHaveTextContent('Room settings changed elsewhere. Your choices are kept');
    expect(save).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Settings' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(save).toHaveBeenCalledExactlyOnceWith({ ...DEFAULT_LIVE_SETTINGS, pickSeconds: 180, sound: false });

    const reopened = (await openSettings()).dialog;
    expect(within(reopened).getByRole('button', { name: '1m' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(reopened).getByRole('switch', { name: 'Kiosk sound effects' })).toHaveAttribute('aria-checked', 'true');
    expect(within(reopened).getByRole('switch', { name: 'Announce each pick on the big screen' })).toHaveAttribute('aria-checked', 'false');
    expect(within(reopened).queryByRole('status')).not.toBeInTheDocument();
  });

  it('submits once while pending and does not let an old acknowledgement close a reopened editor', async () => {
    let resolveSave!: () => void;
    const save = vi.fn(() => new Promise<void>((resolve) => { resolveSave = resolve; }));
    const { rerender } = render(<Harness save={save} />);
    const { dialog } = await openSettings();
    const confirm = within(dialog).getByRole('button', { name: 'Save Settings' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(DEFAULT_LIVE_SETTINGS);
    rerender(<Harness save={save} settings={{ ...DEFAULT_LIVE_SETTINGS, pickSeconds: 60 }} />);
    expect(within(dialog).getByRole('button', { name: '1.5m' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close settings' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await openSettings();
    expect(screen.getByRole('button', { name: '1m' })).toHaveAttribute('aria-pressed', 'true');
    await act(async () => resolveSave());
    expect(screen.getByRole('dialog', { name: 'Room Settings' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save Settings' })).toBeEnabled();
    expect(save).toHaveBeenCalledTimes(1);
  });
});
