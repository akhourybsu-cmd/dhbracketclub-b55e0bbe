import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimTitleScreen, type DeepClaimMenuSummary } from '@/components/deepClaim/menu/DeepClaimTitleScreen';
import { DeepClaimMenuBackdrop, type DeepClaimMenuDiagnostics } from '@/components/deepClaim/menu/DeepClaimMenuBackdrop';
import { DeepClaimPrologue } from '@/components/deepClaim/menu/DeepClaimPrologue';
import { menuSceneGeometry } from '@/components/deepClaim/menu/illustratedScene';
import { DeepClaimPortrait } from '@/components/deepClaim/tutorial/DeepClaimPortrait';
import { TUTORIAL_EXPRESSIONS, TUTORIAL_SPEAKERS } from '@/lib/deepClaim/tutorial/types';

const art = vi.hoisted(() => ({ listeners: new Set<() => void>(), sky: vi.fn(), ground: vi.fn(), activity: vi.fn() }));
vi.mock('@/components/deepClaim/renderer/authoredAtlas', async importOriginal => ({ ...await importOriginal<typeof import('@/components/deepClaim/renderer/authoredAtlas')>(), preloadDeepClaimAtlas: () => Promise.resolve('failed'), subscribeDeepClaimAtlas: (listener: () => void) => { art.listeners.add(listener); return () => art.listeners.delete(listener); }, getDeepClaimAtlasDiagnostics: () => ({ state: 'failed', width: 1024, height: 800, spriteCount: 2255, decodedBytes: 0, draws: 0 }) }));
vi.mock('@/components/deepClaim/menu/illustratedScene', async importOriginal => ({ ...await importOriginal<typeof import('@/components/deepClaim/menu/illustratedScene')>(), paintMenuSkyLayer: art.sky, paintMenuGroundLayer: art.ground, paintMenuActivity: art.activity }));

let visibility: DocumentVisibilityState = 'visible', clock = 0, nextFrame = 0;
const frames = new Map<number, FrameRequestCallback>();
const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
const bounds = { width: 320, height: 568, x: 0, y: 0, top: 0, left: 0, right: 320, bottom: 568, toJSON: () => ({}) };
const summary: DeepClaimMenuSummary = { companyName: 'Flint & Vale', supportedDepth: 999, employeeCount: 3, activeExpeditions: 2, readyCollections: 1, lastSyncedAt: '2026-11-02T09:32:00Z' };
function controls() { return { onContinue: vi.fn(), onNewGame: vi.fn(), onJournal: vi.fn(), onSettings: vi.fn(), onExit: vi.fn(), onRetry: vi.fn(), onInteraction: vi.fn() }; }
function paintAt(at: number) { act(() => { const delta = Math.max(0, at - clock); clock = at; vi.advanceTimersByTime(delta); const pending = [...frames.values()]; frames.clear(); for (const frame of pending) frame(at); }); }
function canvasContext() { return { setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), fillStyle: '', imageSmoothingEnabled: true }; }
beforeEach(() => {
  localStorage.clear();
  visibility = 'visible'; clock = 0; nextFrame = 0; frames.clear(); art.listeners.clear(); art.sky.mockClear(); art.ground.mockClear(); art.activity.mockClear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(bounds);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); frames.clear();
  if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility); else delete (document as unknown as Record<string, unknown>).visibilityState;
});

describe('Deep Claim functional title front door', () => {
  it('makes New Game primary without a save and does not bootstrap or navigate until an explicit choice', () => {
    const actions = controls(); render(<DeepClaimTitleScreen summary={null} {...actions} />);
    expect(screen.getByRole('heading', { name: 'DEEP CLAIM' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'New Game' })).toHaveClass('is-primary');
    expect(within(screen.getByRole('navigation', { name: 'Deep Claim main menu' })).getAllByRole('button')).toHaveLength(5);
    expect(actions.onNewGame).not.toHaveBeenCalled(); expect(actions.onInteraction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    expect(actions.onNewGame).toHaveBeenCalledOnce(); expect(actions.onInteraction).toHaveBeenCalledOnce();
  });
  it('shows only the authorized save summary and keeps Continue separate from founding', () => {
    const actions = controls(); render(<DeepClaimTitleScreen summary={summary} {...actions} />);
    expect(screen.getByTestId('deep-claim-title')).toHaveAttribute('data-dc-menu-save', 'verified');
    expect(screen.getByText('Flint & Vale')).toBeVisible(); expect(screen.getByText('999 m supported')).toBeVisible();
    expect(screen.getByText('3 crew')).toBeVisible(); expect(screen.getByText('1 return ready')).toBeVisible();
    expect(screen.queryByText(/deepest/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass('is-primary');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(actions.onContinue).toHaveBeenCalledOnce(); expect(actions.onNewGame).not.toHaveBeenCalled();
  });
  it('protects an existing company from New Game and offers a real tutorial replay alternative', () => {
    const actions = controls(); render(<DeepClaimTitleScreen summary={summary} {...actions} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    const dialog = screen.getByRole('dialog', { name: 'One claim. Yours.' });
    expect(dialog).toHaveTextContent('Flint & Vale'); expect(dialog).toHaveTextContent('one company per member in each club');
    expect(actions.onNewGame).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Replay tutorial' }));
    expect(actions.onJournal).toHaveBeenCalledOnce(); expect(actions.onNewGame).not.toHaveBeenCalled();
  });
  it('lets the protected-save explanation safely resume the current company', () => {
    const actions = controls(); render(<DeepClaimTitleScreen summary={summary} {...actions} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Continue' }));
    expect(actions.onContinue).toHaveBeenCalledOnce(); expect(actions.onNewGame).not.toHaveBeenCalled();
  });
  it('blocks save-dependent choices during resolution while journal, settings and exit stay usable', () => {
    const actions = controls(); render(<DeepClaimTitleScreen summary={null} loading {...actions} />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'New Game' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Tutorial & Field Guide' })); fireEvent.click(screen.getByRole('button', { name: 'Settings' })); fireEvent.click(screen.getByRole('button', { name: 'Return to DH Club' }));
    expect(actions.onJournal).toHaveBeenCalledOnce(); expect(actions.onSettings).toHaveBeenCalledOnce(); expect(actions.onExit).toHaveBeenCalledOnce();
  });
  it('distinguishes cached reports and exposes a connection retry without inventing fresh save data', () => {
    const actions = controls(); render(<DeepClaimTitleScreen summary={summary} cached error="The camp connection is unavailable." {...actions} />);
    expect(screen.getByTestId('deep-claim-title')).toHaveAttribute('data-dc-menu-save', 'cached');
    expect(screen.getByText('Cached company')).toBeVisible(); expect(screen.getByText('Showing your last saved report.')).toBeVisible();
    expect(document.querySelector('time')).toHaveAttribute('dateTime', '2026-11-02T09:32:00.000Z');
    fireEvent.click(screen.getByRole('button', { name: 'Retry connection' })); expect(actions.onRetry).toHaveBeenCalledOnce();
    expect(actions.onContinue).not.toHaveBeenCalled();
  });
  it('supports game-style arrow navigation, skips unavailable choices and preserves native activation', () => {
    const actions = controls(); render(<DeepClaimTitleScreen summary={null} {...actions} />);
    const start = screen.getByRole('button', { name: 'New Game' }); start.focus(); fireEvent.keyDown(start, { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: 'Tutorial & Field Guide' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'End' }); expect(screen.getByRole('button', { name: 'Return to DH Club' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Home' }); expect(start).toHaveFocus();
    fireEvent.keyDown(start, { key: 'Escape' }); expect(actions.onExit).toHaveBeenCalledOnce();
  });
  it('keeps menu actions usable when optional canvas artwork and optional audio cues fail', () => {
    const actions = controls(); actions.onInteraction.mockImplementation(() => { throw new Error('Audio unavailable'); });
    render(<DeepClaimTitleScreen summary={null} {...actions} reducedMotion />);
    expect(screen.getByTestId('deep-claim-menu-backdrop')).toHaveAttribute('data-dc-menu-state', 'unsupported');
    expect(screen.getByTestId('deep-claim-menu-backdrop')).toHaveAttribute('data-dc-title-scene', 'illustrative');
    fireEvent.click(screen.getByRole('button', { name: 'New Game' })); expect(actions.onNewGame).toHaveBeenCalledOnce();
    expect(screen.getByTestId('deep-claim-title')).toHaveAttribute('data-dc-reduced-motion', 'true');
  });
});

describe('Deep Claim concise founding flow', () => {
  function founding() { return { identity: 'menu-test:club', clubName: 'The Club', reducedMotion: true, reducedGraphics: true, busy: false, blocked: false, onBack: vi.fn(), onFound: vi.fn().mockResolvedValue(undefined), onInteraction: vi.fn() }; }
  it('provides one clear introduction skip and reviews a persistent company before signing', async () => {
    const actions = founding(); render(<DeepClaimPrologue {...actions} />);
    expect(screen.getAllByRole('button', { name: 'Skip introduction' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Skip dialogue' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip introduction' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Company name' }), { target: { value: '  Flint Works  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review deed' }));
    expect(actions.onFound).not.toHaveBeenCalled();
    const facts = screen.getByRole('group', { name: 'Starting company' });
    expect(facts).toHaveTextContent('3 crew'); expect(facts).toHaveTextContent('Persistent mine'); expect(facts).toHaveTextContent('30s first shift');
    expect(screen.getByText(/One company per member, per club/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Edit name' }));
    expect(screen.getByRole('textbox', { name: 'Company name' })).toHaveValue('  Flint Works  ');
    fireEvent.click(screen.getByRole('button', { name: 'Review deed' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Found company' })); });
    expect(actions.onFound).toHaveBeenCalledExactlyOnceWith('Flint Works');
  });
  it('keeps the reviewed company intact and blocks signing while a server action is pending or read-only', () => {
    const actions = founding(); const view = render(<DeepClaimPrologue {...actions} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip introduction' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Company name' }), { target: { value: 'Vale Works' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review deed' }));
    view.rerender(<DeepClaimPrologue {...actions} busy />);
    expect(screen.getByRole('button', { name: 'Signing the deed…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit name' })).toBeDisabled();
    view.rerender(<DeepClaimPrologue {...actions} blocked />);
    expect(screen.getByText('Vale Works')).toBeVisible();
    const sign = screen.getByRole('button', { name: 'Found company' }); expect(sign).toBeDisabled(); fireEvent.click(sign);
    expect(actions.onFound).not.toHaveBeenCalled();
  });
});

describe('Original title illustration lifecycle and budgets', () => {
  it('uses uniform cover geometry for small portrait, landscape and desktop, with a closer founding view', () => {
    for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1440, 900]]) {
      const title = menuSceneGeometry(width, height, 'title'), founding = menuSceneGeometry(width, height, 'founding');
      expect(title.scale * 960).toBeGreaterThanOrEqual(width - .000001); expect(title.scale * 760).toBeGreaterThanOrEqual(height - .000001);
      expect(founding.scale).toBeGreaterThan(title.scale); expect([title.x, title.y, title.scale].every(Number.isFinite)).toBe(true);
    }
  });
  it('caches static artwork once and redraws only on explicit invalidation with reduced motion', () => {
    const c = canvasContext(); vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(c as unknown as CanvasRenderingContext2D);
    const sample = vi.fn<(data: DeepClaimMenuDiagnostics) => void>();
    const root = render(<DeepClaimMenuBackdrop reducedMotion onDiagnostics={sample} />); paintAt(1000);
    expect(art.sky).toHaveBeenCalledOnce(); expect(art.ground).toHaveBeenCalledOnce(); expect(frames.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
    expect(art.activity).toHaveBeenCalledWith(expect.anything(), 0, false, false);
    act(() => { for (const listener of art.listeners) listener(); }); paintAt(2000);
    expect(art.sky).toHaveBeenCalledTimes(2); expect(frames.size).toBe(0);
    root.unmount(); expect(art.listeners.size).toBe(0);
  });
  it('stops scheduling when hidden or inactive and disposes all frame, timer and atlas subscriptions', () => {
    const c = canvasContext(); vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(c as unknown as CanvasRenderingContext2D);
    const root = render(<DeepClaimMenuBackdrop />); paintAt(1000); expect(vi.getTimerCount()).toBeGreaterThan(0);
    act(() => { visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); });
    expect(frames.size).toBe(0); expect(vi.getTimerCount()).toBe(0); expect(screen.getByTestId('deep-claim-menu-backdrop')).toHaveAttribute('data-dc-menu-state', 'inactive');
    act(() => { visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); }); expect(frames.size).toBe(1); paintAt(2000);
    root.rerender(<DeepClaimMenuBackdrop active={false} />); expect(frames.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
    root.unmount(); expect(art.listeners.size).toBe(0); expect(frames.size).toBe(0);
  });
  it('caps physical canvas and both cache buffers on a large high-DPR screen', () => {
    const c = canvasContext(); vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(c as unknown as CanvasRenderingContext2D);
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue({ ...bounds, width: 1920, height: 1080, right: 1920, bottom: 1080 });
    vi.stubGlobal('devicePixelRatio', 3);
    const samples: DeepClaimMenuDiagnostics[] = []; render(<DeepClaimMenuBackdrop reducedGraphics onDiagnostics={sample => samples.push(sample)} />); paintAt(1000);
    const last = samples.at(-1)!; expect(last.backingPixels).toBeLessThanOrEqual(1_000_000); expect(last.cachePixels).toBe(last.backingPixels * 2);
    expect(last.atlasState).toBe('failed'); expect(art.ground).toHaveBeenCalledWith(expect.anything(), true);
  });
});

describe('Original Gus and starter portraits', () => {
  it('provides all named speakers and six distinct readable expressions without image downloads or employee records', () => {
    const { container } = render(<>{TUTORIAL_SPEAKERS.map(speaker => <DeepClaimPortrait key={speaker} speaker={speaker} />)}</>);
    expect(screen.getAllByRole('img')).toHaveLength(4); expect(screen.getByRole('img', { name: /Gus.*Calloway, neutral/ })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Mara Flint, neutral' })).toBeVisible(); expect(screen.getByRole('img', { name: 'Ivo Vale, neutral' })).toBeVisible(); expect(screen.getByRole('img', { name: 'Tessa Pike, neutral' })).toBeVisible();
    expect(container.querySelector('image,img,canvas')).toBeNull();
    cleanup(); const variants = render(<>{TUTORIAL_EXPRESSIONS.map(expression => <DeepClaimPortrait key={expression} speaker="gus" expression={expression} />)}</>);
    const expressions = [...variants.container.querySelectorAll('[data-dc-portrait-expression]')]; expect(expressions).toHaveLength(6); expect(new Set(expressions.map(node => node.innerHTML)).size).toBe(6);
  });
  it('can serve as decorative dialogue artwork without duplicating the speaker announcement', () => {
    const { container } = render(<DeepClaimPortrait speaker="gus" expression="proud" decorative />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument(); expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
