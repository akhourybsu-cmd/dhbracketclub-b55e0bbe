import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimSettings } from '@/components/deepClaim/DeepClaimSettings';
import { DeepClaimPrologue } from '@/components/deepClaim/menu/DeepClaimPrologue';
import { DeepClaimTitleScreen } from '@/components/deepClaim/menu/DeepClaimTitleScreen';
import { DeepClaimTutorialDialogue } from '@/components/deepClaim/tutorial/DeepClaimTutorialDialogue';
import { ClaimDialog } from '@/components/deepClaim/DeepClaimPrimitives';
import type { DeepClaimAudio, DeepClaimAudioSettings } from '@/lib/deepClaim/audio';
import type { DialogueScene } from '@/lib/deepClaim/tutorial/types';

vi.mock('@/components/deepClaim/menu/DeepClaimMenuBackdrop', () => ({ DeepClaimMenuBackdrop: () => null }));
vi.mock('@/hooks/useNotificationPreferences', () => ({ useNotificationPreferences: () => ({ prefs: { deep_claim: true }, loading: false, saving: false, error: null, update: vi.fn(), refresh: vi.fn() }) }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function soundController() {
  let settings: DeepClaimAudioSettings = { master: false, music: true, sfx: true, ambient: true, volume: .65, musicVolume: 1, ambientVolume: 1, sfxVolume: 1 };
  const listeners = new Set<() => void>();
  const unlock = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
  const updateSettings = vi.fn((patch: Partial<DeepClaimAudioSettings>) => {
    settings = { ...settings, ...patch }; listeners.forEach(listener => listener());
  });
  const controller = {
    getSnapshot: () => settings,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    updateSettings, unlock,
  } as unknown as DeepClaimAudio;
  return { controller, unlock, updateSettings };
}
function settingsProps(audio: DeepClaimAudio) {
  return { audio, visuals: { reducedMotion: false, reducedGraphics: false }, onVisualsChange: vi.fn(), onRefresh: vi.fn(), refreshing: false };
}
function foundingProps(identity = 'member:club-a') {
  return { identity, clubName: 'The Club', reducedMotion: true, reducedGraphics: true, busy: false, blocked: false, onBack: vi.fn(), onFound: vi.fn<(_name: string) => Promise<void>>().mockResolvedValue(undefined), onInteraction: vi.fn() };
}
function reviewDeed(name = 'Flint Works') {
  fireEvent.click(screen.getByRole('button', { name: 'Skip introduction' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Company name' }), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Review deed' }));
  return screen.getByRole('button', { name: 'Found company' }).closest('form')!;
}
const scene: DialogueScene = {
  id: 'entry.audit', title: 'The old claim', estimated_read_seconds: 5,
  lines: [
    { id: 'audit.gus', text_key: 'audit.gus', speaker: 'gus', expression: 'amused', text: 'Ready when you are.', next: 'audit.mara' },
    { id: 'audit.mara', text_key: 'audit.mara', speaker: 'mara', expression: 'neutral', text: 'I’ll get the tools.', next: null },
  ],
};
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Deep Claim sound settings recovery', () => {
  it('requires a gesture and keeps a pending sound start to one request', async () => {
    const audio = soundController(), start = deferred<boolean>(); audio.unlock.mockReturnValue(start.promise);
    render(<DeepClaimSettings {...settingsProps(audio.controller)} />);
    const sound = screen.getByRole('switch', { name: 'Enable sound' });
    expect(audio.unlock).not.toHaveBeenCalled();
    fireEvent.click(sound); fireEvent.click(sound);
    expect(audio.unlock).toHaveBeenCalledOnce();
    expect(sound).toBeDisabled(); expect(sound).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Starting…');
    await act(async () => start.resolve(true));
    expect(sound).toBeEnabled(); expect(sound).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('On');
    fireEvent.click(sound);
    expect(sound).not.toBeChecked(); expect(audio.unlock).toHaveBeenCalledOnce();
  });
  it('recovers from a rejected audio unlock and allows a real retry', async () => {
    const audio = soundController(); audio.unlock.mockRejectedValueOnce(new Error('AudioContext interrupted'));
    render(<DeepClaimSettings {...settingsProps(audio.controller)} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Enable sound' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sound could not start on this device.');
    const sound = screen.getByRole('switch', { name: 'Enable sound' });
    expect(sound).toBeEnabled(); expect(sound).not.toBeChecked();
    expect(audio.controller.getSnapshot().volume).toBe(.65);
    fireEvent.click(sound);
    await waitFor(() => expect(sound).toBeEnabled());
    expect(sound).toBeChecked(); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(audio.unlock).toHaveBeenCalledTimes(2);
  });
  it('does not let an old controller response overwrite a newly selected controller', async () => {
    const oldAudio = soundController(), nextAudio = soundController(), start = deferred<boolean>();
    oldAudio.unlock.mockReturnValue(start.promise);
    const view = render(<DeepClaimSettings {...settingsProps(oldAudio.controller)} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Enable sound' }));
    view.rerender(<DeepClaimSettings {...settingsProps(nextAudio.controller)} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Enable sound' }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Enable sound' })).toBeEnabled());
    await act(async () => start.resolve(false));
    expect(screen.getByRole('switch', { name: 'Enable sound' })).toBeChecked();
    expect(oldAudio.updateSettings).toHaveBeenCalledExactlyOnceWith({ master: true });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('ignores an interrupted sound response after leaving Settings', async () => {
    const audio = soundController(), start = deferred<boolean>(); audio.unlock.mockReturnValue(start.promise);
    const view = render(<DeepClaimSettings {...settingsProps(audio.controller)} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Enable sound' })); view.unmount();
    await act(async () => start.reject(new Error('Page left')));
    expect(audio.updateSettings).toHaveBeenCalledExactlyOnceWith({ master: true });
  });
  it('returns to a valid tab when Updates is no longer available', () => {
    const audio = soundController(), props = settingsProps(audio.controller);
    const view = render(<DeepClaimSettings {...props} business />);
    fireEvent.click(screen.getByRole('tab', { name: 'Updates' }));
    expect(screen.getByRole('tabpanel', { name: 'Updates' })).toBeInTheDocument();
    view.rerender(<DeepClaimSettings {...props} business={false} />);
    expect(screen.queryByRole('tab', { name: 'Updates' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sound' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Sound' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Sound' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Visuals' })).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: 'Visuals' })).toBeInTheDocument();
  });
  it('changes visual preferences independently without enabling audio', () => {
    const audio = soundController(), props = settingsProps(audio.controller);
    render(<DeepClaimSettings {...props} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Visuals' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Reduced motion' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Reduced graphics' }));
    expect(props.onVisualsChange.mock.calls).toEqual([[{ reducedMotion: true }], [{ reducedGraphics: true }]]);
    expect(audio.unlock).not.toHaveBeenCalled(); expect(audio.updateSettings).not.toHaveBeenCalled();
  });
});

describe('Deep Claim deed navigation and duplicate protection', () => {
  it('keeps a protected-save Continue disabled when a pending refresh or action begins', () => {
    const props = {
      summary: { companyName: 'Flint Works', supportedDepth: 49, employeeCount: 3, activeExpeditions: 0, readyCollections: 0, lastSyncedAt: null },
      onContinue: vi.fn(), onNewGame: vi.fn(), onJournal: vi.fn(), onSettings: vi.fn(), onExit: vi.fn(),
    };
    const view = render(<DeepClaimTitleScreen {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    const dialog = screen.getByRole('dialog', { name: 'Existing company' });
    view.rerender(<DeepClaimTitleScreen {...props} loading />);
    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled();
    view.rerender(<DeepClaimTitleScreen {...props} busy />);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(props.onContinue).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Replay tutorial' })).toBeEnabled();
    expect(within(dialog).getByRole('button', { name: 'Back' })).toBeEnabled();
    view.rerender(<DeepClaimTitleScreen {...props} />);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(props.onContinue).toHaveBeenCalledOnce();
  });
  it('moves keyboard focus through the introduction, name, review and edit screens', () => {
    render(<DeepClaimPrologue {...foundingProps()} />);
    expect(screen.getByRole('region', { name: /dialogue$/ })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Skip introduction' }));
    expect(screen.getByRole('textbox', { name: 'Company name' })).toHaveFocus();
    fireEvent.change(screen.getByRole('textbox', { name: 'Company name' }), { target: { value: 'Flint Works' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review deed' }));
    expect(screen.getByRole('heading', { name: 'Sign the deed.' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Edit name' }));
    expect(screen.getByRole('textbox', { name: 'Company name' })).toHaveFocus();
  });
  it('blocks repeat signing and navigation until the actual founding promise settles', async () => {
    const props = foundingProps(), found = deferred<void>(); props.onFound.mockReturnValue(found.promise);
    render(<DeepClaimPrologue {...props} />);
    const form = reviewDeed('  Flint Works  ');
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(props.onFound).toHaveBeenCalledExactlyOnceWith('Flint Works');
    expect(screen.getByRole('button', { name: 'Signing the deed…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit name' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Main menu' })).toBeDisabled();
    await act(async () => found.resolve());
    expect(localStorage.getItem('dh:deep-claim:deed-draft:v1:member:club-a')).toBeNull();
    expect(screen.getByRole('button', { name: 'Main menu' })).toBeEnabled();
  });
  it('keeps the deed on a failed request and allows signing again without losing its name', async () => {
    const props = foundingProps(); props.onFound.mockRejectedValueOnce(new Error('Connection interrupted'));
    render(<DeepClaimPrologue {...props} />); reviewDeed();
    fireEvent.click(screen.getByRole('button', { name: 'Found company' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection interrupted');
    expect(screen.getByText('Flint Works')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Found company' })).toBeEnabled();
    expect(JSON.parse(localStorage.getItem('dh:deep-claim:deed-draft:v1:member:club-a')!).name).toBe('Flint Works');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Found company' })));
    expect(props.onFound).toHaveBeenCalledTimes(2);
  });
  it('isolates company drafts when switching identity and restores only the matching draft', () => {
    const props = foundingProps(); const view = render(<DeepClaimPrologue {...props} />); reviewDeed('Club A Works');
    view.rerender(<DeepClaimPrologue {...props} identity="member:club-b" clubName="Second Club" />);
    expect(screen.getByRole('button', { name: 'Skip introduction' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip introduction' }));
    expect(screen.getByRole('textbox', { name: 'Company name' })).toHaveValue('');
    view.rerender(<DeepClaimPrologue {...props} />);
    expect(screen.getByRole('heading', { name: 'Sign the deed.' })).toHaveFocus();
    expect(screen.getByText('Club A Works')).toBeInTheDocument();
  });
  it('ignores a previous identity’s failure and blocks synthetic read-only submissions', async () => {
    const props = foundingProps(), found = deferred<void>(); props.onFound.mockReturnValue(found.promise);
    const view = render(<DeepClaimPrologue {...props} />); fireEvent.submit(reviewDeed());
    view.rerender(<DeepClaimPrologue {...props} identity="member:club-b" blocked />);
    await act(async () => found.reject(new Error('Old identity failed')));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip introduction' }));
    fireEvent.submit(screen.getByRole('textbox', { name: 'Company name' }).closest('form')!);
    expect(props.onFound).toHaveBeenCalledOnce();
  });
});

describe('Deep Claim conversation history keyboard behavior', () => {
  it('closes history first on Escape inside a real dialog without skipping the conversation', () => {
    const advance = vi.fn(), skip = vi.fn();
    render(<ClaimDialog open title="Camp conversation" onClose={skip}><DeepClaimTutorialDialogue scene={scene} lineIndex={0} onAdvance={advance} onSkip={skip} /></ClaimDialog>);
    fireEvent.click(screen.getByRole('button', { name: 'Dialogue history' }));
    const heading = screen.getByRole('heading', { name: 'Camp conversations' }); expect(heading).toHaveFocus();
    fireEvent.keyDown(heading, { key: 'ArrowRight' }); expect(advance).not.toHaveBeenCalled();
    fireEvent.keyDown(heading, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Dialogue history' })).not.toBeInTheDocument();
    const history = screen.getByRole('button', { name: 'Dialogue history' }); expect(history).toHaveFocus();
    expect(skip).not.toHaveBeenCalled();
    fireEvent.keyDown(history, { key: 'Escape' }); expect(skip).toHaveBeenCalledOnce();
  });
  it('returns focus after closing history and closes old history when the conversation changes', () => {
    const props = { scene, lineIndex: 0, onAdvance: vi.fn(), onSkip: vi.fn() };
    const view = render(<DeepClaimTutorialDialogue {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dialogue history' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close dialogue history' }));
    expect(screen.getByRole('button', { name: 'Dialogue history' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Dialogue history' }));
    view.rerender(<DeepClaimTutorialDialogue {...props} scene={{ ...scene, id: 'next.audit', title: 'Next conversation' }} />);
    expect(screen.queryByRole('region', { name: 'Dialogue history' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dialogue history' })).toHaveFocus();
    expect(props.onAdvance).not.toHaveBeenCalled(); expect(props.onSkip).not.toHaveBeenCalled();
  });
  it.each([[-2, 1], [Number.NaN, 1], [Number.POSITIVE_INFINITY, 1], [200, 2]])('keeps progress valid for a stale line index %s', (lineIndex, expected) => {
    render(<DeepClaimTutorialDialogue scene={scene} lineIndex={lineIndex} onAdvance={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(expected));
    expect(screen.getByRole('button', { name: 'Advance dialogue' })).toHaveTextContent(scene.lines[expected - 1].text);
  });
});
