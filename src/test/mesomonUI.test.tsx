import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MesomonGame } from '@/pages/MesomonPage';
import { createNewSave } from '@/lib/mesomon/engine';
import type { MesomonSaveV1 } from '@/lib/mesomon/types';

const fixture = vi.hoisted(() => ({
  save: null as MesomonSaveV1 | null,
  saveLocal: vi.fn(), flush: vi.fn(async () => {}), retry: vi.fn(async () => {}), reload: vi.fn(async () => {}),
  useCloud: vi.fn(async () => {}), keepLocal: vi.fn(async () => {}),
  viewCreate: vi.fn(), viewDestroy: vi.fn(), audioCreate: vi.fn(), audioDestroy: vi.fn(),
  blocked:false,blockReason:'',loading:false,
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'test-user' }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: 'test-club' }, loading: false }) }));
vi.mock('@/hooks/useClubAssets', () => ({ useClubAssets: () => ({ loading: false, isInstalled: () => true }) }));
vi.mock('@/hooks/useMesomonSave', () => ({ useMesomonSave: () => ({
  save: fixture.save, loading: fixture.loading, status: 'local', error: null, conflict: null,
  saveLocal: fixture.saveLocal, flush: fixture.flush, retry: fixture.retry, reload: fixture.reload,
  useCloud: fixture.useCloud, keepLocal: fixture.keepLocal,
  blocked:fixture.blocked,blockReason:fixture.blockReason,
}) }));
vi.mock('@/lib/mesomon/renderer/createGame', () => ({
  createMesomonView: async (parent: HTMLElement, options: { signal?: AbortSignal }) => {
    fixture.viewCreate();
    const canvas = document.createElement('canvas'); canvas.width=160;canvas.height=144;
    if (!options.signal?.aborted) parent.appendChild(canvas);
    return { update: vi.fn(), pause: vi.fn(), sealAccuracy: () => 1,
      destroy: () => { fixture.viewDestroy(); canvas.remove(); } };
  },
}));
vi.mock('@/lib/mesomon/audio', () => ({ MesomonAudio: class {
  constructor() { fixture.audioCreate(); }
  unlock = async () => {};
  setSettings = vi.fn(); setScene = vi.fn(); cue = vi.fn(); pause = vi.fn();
  destroy = () => fixture.audioDestroy();
} }));

beforeEach(() => {
  vi.clearAllMocks(); fixture.save=null;fixture.blocked=false;fixture.blockReason='';fixture.loading=false;localStorage.clear();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const USER='11111111-1111-4111-8111-111111111111', CLUB='22222222-2222-4222-8222-222222222222';
function mount(strict=false) {
  const game=<MemoryRouter><MesomonGame userId={USER} clubId={CLUB} /></MemoryRouter>;
  return render(strict?<StrictMode>{game}</StrictMode>:game);
}
async function begin() { fireEvent.click(await screen.findByRole('button',{name:/Begin journey|Continue journey/})); }
function openStart() {
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  return within(screen.getByRole('dialog', { name: 'Start menu' }));
}

describe('Mesomon game shell', () => {
  it('shows the empty cuff and only discoveries already entered in this file', async () => {
    fixture.save = createNewSave();
    fixture.save.questFlags.disembarked = true;
    fixture.save.questFlags.captain_met = true;
    mount();
    await begin();
    const fieldcase = openStart();
    fireEvent.click(fieldcase.getByRole('button', {name: 'Companions'}));
    expect(fieldcase.getByRole('img', {name: /brass cuff/i})).toBeVisible();
    fireEvent.click(fieldcase.getByRole('button', {name: 'Back'}));
    fireEvent.click(fieldcase.getByRole('button', {name: 'Journal'}));
    expect(fieldcase.getByText('Edda asked me to bring my core home.')).toBeVisible();
    expect(fieldcase.getByText('Came ashore on the lower quay.')).toBeVisible();
    expect(fieldcase.getByText('Nia is waiting at the arrival pier.')).toBeVisible();
    expect(fieldcase.queryByText(/Wretch|sealed rift|upper channel/i)).toBeNull();
    expect(fieldcase.queryByRole('heading', { name: 'On the quay' })).toBeNull();
  });
  it('shows the current errand in the journal when returning with Pell’s whistle', async () => {
    fixture.save = createNewSave();
    Object.assign(fixture.save.questFlags, { whistle_accepted: true, whistle_found: true });
    mount();
    await begin();
    const journal = openStart();
    fireEvent.click(journal.getByRole('button', { name: 'Journal' }));
    expect(journal.getByText('Found the tin whistle. Bring it back to Pell.')).toBeVisible();
    expect(journal.queryByText(/has the whistle back|fisher’s net/i)).toBeNull();
  });
  it('keeps the console unbranded and exits a running game through its pause menu', async () => {
    render(
      <MemoryRouter initialEntries={['/mesomon']}>
        <Routes>
          <Route path="/mesomon" element={<MesomonGame userId={USER} clubId={CLUB} />} />
          <Route path="/compete" element={<h1>Compete</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole('button', { name: 'Begin journey' });
    const exit = { name: 'Exit game', exact: true };
    const brand = /\b(?:DHF?|Dry (?:My )?Horse)\b/i;
    const consoleShell = document.querySelector('.mesomon')!;
    expect(consoleShell).not.toHaveTextContent(brand);
    expect(consoleShell.querySelector('.mm-header, .mm-location')).toBeNull();
    expect(screen.queryByRole('link', exit)).not.toBeInTheDocument();
    const titleMenu = openStart();
    expect(titleMenu.getByRole('link', exit)).toHaveAttribute('href', '/compete');
    fireEvent.click(titleMenu.getByRole('button', { name: 'Back to title' }));
    expect(fixture.saveLocal).not.toHaveBeenCalled();
    await begin();
    expect(consoleShell).not.toHaveTextContent(brand);
    expect(screen.queryByRole('link', exit)).not.toBeInTheDocument();
    expect(consoleShell.querySelector('.mm-header, .mm-location')).toBeNull();
    const menu = openStart();
    expect(screen.getByRole('dialog')).not.toHaveTextContent(brand);
    fixture.flush.mockClear();
    fixture.saveLocal.mockClear();
    fireEvent.click(menu.getByRole('link', exit));
    expect(await screen.findByRole('heading', { name: 'Compete' })).toBeVisible();
    expect(document.querySelector('.mesomon')).not.toBeInTheDocument();
    expect(fixture.flush).toHaveBeenCalled();
    expect(fixture.saveLocal).toHaveBeenCalled();
  });

  it('offers three explicit files and waits for player interaction before unlocking audio', async () => {
    mount();
    expect(await screen.findByRole('button',{name:'File 1'})).toHaveAttribute('aria-pressed','true');
    expect(screen.getByRole('button',{name:'File 2'})).toHaveAttribute('aria-pressed','false');
    expect(screen.getByRole('button',{name:'File 3'})).toHaveAttribute('aria-pressed','false');
    expect(fixture.audioCreate).not.toHaveBeenCalled();
    await begin();
    expect(fixture.audioCreate).toHaveBeenCalledOnce();
    expect(screen.getByRole('button',{name:'A — Confirm'})).toBeVisible();
    expect(screen.getByRole('button',{name:'B — Cancel'})).toBeVisible();
    await waitFor(()=>expect(fixture.saveLocal).toHaveBeenCalled());
  });

  it('paces held arrows in reduced motion and ignores OS repeat after release', async () => {
    fixture.save = createNewSave();
    fixture.save.settings.reducedMotion = true;
    mount();
    await begin();
    vi.useFakeTimers();
    try {
      const shell = document.querySelector('.mesomon')!;
      fireEvent.keyDown(window, { key: 'ArrowUp' });
      expect(shell).toHaveAttribute('data-player-y', '8');
      fireEvent.keyDown(window, { key: 'ArrowUp', repeat: true });
      act(() => vi.advanceTimersByTime(199));
      expect(shell).toHaveAttribute('data-player-y', '8');
      act(() => vi.advanceTimersByTime(1));
      expect(shell).toHaveAttribute('data-player-y', '7');
      fireEvent.keyUp(window, { key: 'ArrowUp' });
      fireEvent.keyDown(window, { key: 'ArrowUp', repeat: true });
      act(() => vi.advanceTimersByTime(400));
      expect(shell).toHaveAttribute('data-player-y', '7');
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses real engine movement for keyboard-operable direction buttons', async () => {
    fixture.save=createNewSave(); fixture.save.dialogue=null;
    mount(); await begin();
    const root=document.querySelector('.mesomon')!;
    const before=Number(root.getAttribute('data-player-y'));
    fireEvent.click(screen.getByRole('button',{name:'Move up'}),{detail:0});
    await waitFor(()=>expect(Number(root.getAttribute('data-player-y'))).toBe(before-1));
    expect(fixture.saveLocal.mock.calls.at(-1)?.[0].player.y).toBe(before-1);
  });

  it('A opens the actual nearby conversation and keeps the full line available to assistive technology', async () => {
    fixture.save=createNewSave(); fixture.save.dialogue=null; fixture.save.player={...fixture.save.player,x:8,y:6};
    fixture.save.settings.textSpeed = 'fast';
    mount(); await begin();
    fireEvent.click(screen.getByRole('button',{name:'A — Confirm'}));
    const conversation=await screen.findByRole('region',{name:'Conversation'});
    expect(within(conversation).getByText('Captain',{exact:true})).toBeVisible();
    expect(conversation.querySelector('[aria-live="polite"]')).toHaveTextContent('Port Marche.');
    const start = openStart();
    fireEvent.click(start.getByRole('button', {name:'Map'}));
    expect(start.getByRole('region', {name:'Location chart'})).toBeVisible();
    fireEvent.keyDown(window, {key:'m'});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(conversation.querySelector('[aria-live="polite"]')).toHaveTextContent('Port Marche.');
    const startKey = screen.getByRole('button', {name:'Start'});
    expect(startKey).toHaveFocus();
    fireEvent.keyDown(startKey, {key:'z'});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(conversation.querySelector('[aria-live="polite"]')).toHaveTextContent('Can you see Edda? Grey coat, lamp on her belt.');
    expect(within(conversation).getByRole('button',{name:'Continue'})).toBeVisible();
  });

  it('preserves a timed seal pulse while the player uses the Start menu', async () => {
    fixture.save = createNewSave();
    fixture.save.questFlags.boss_defeated = true;
    fixture.save.seal.active = true;
    mount();
    const continueJourney = await screen.findByRole('button', {name:'Continue journey'});
    vi.useFakeTimers({toFake:['performance', 'setInterval', 'clearInterval']});
    try {
      fireEvent.click(continueJourney);
      act(() => vi.advanceTimersByTime(1280));
      const start = openStart();
      fireEvent.click(start.getByRole('button', {name:'Journal'}));
      act(() => vi.advanceTimersByTime(5000));
      fireEvent.keyDown(window, {key:'b'});
      fireEvent.click(start.getByRole('button', {name:'Resume'}));
      fireEvent.click(screen.getByRole('button', {name:'Seal pulse'}));
      expect(screen.getByLabelText('1 of 3 pulses aligned')).toBeInTheDocument();
      expect(fixture.saveLocal.mock.calls.at(-1)?.[0].seal).toMatchObject({ attempts:1, pulses:1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps Settings open across explicit and browser-initiated WebKit fullscreen changes', async () => {
    let owner: Element | null = null;
    const properties: [object, string, PropertyDescriptor][] = [
      [document, 'webkitFullscreenElement', { get: () => owner }],
      [document, 'webkitFullscreenEnabled', { value: true }],
      [document, 'webkitExitFullscreen', { value: () => {
        owner = null;
        fireEvent(document, new Event('webkitfullscreenchange'));
      } }],
      [HTMLElement.prototype, 'webkitRequestFullscreen', { value: () => {
        owner = document.querySelector('.mm-device');
        fireEvent(document, new Event('webkitfullscreenchange'));
      } }],
    ];
    const previous = properties.map(([object, key]) => Object.getOwnPropertyDescriptor(object, key));
    try {
      properties.forEach(([object, key, descriptor]) => Object.defineProperty(object, key, { ...descriptor, configurable: true }));
      mount();
      await begin();
      expect(screen.queryByRole('button', { name: /full screen/i })).toBeNull();
      const menu = openStart();
      fireEvent.click(menu.getByRole('button', { name: 'Settings' }));
      fireEvent.click(menu.getByRole('button', { name: 'Enter full screen' }));
      fireEvent.click(await menu.findByRole('button', { name: 'Leave full screen' }));
      fireEvent.click(await menu.findByRole('button', { name: 'Enter full screen' }));
      await menu.findByRole('button', { name: 'Leave full screen' });
      const assist = menu.getByRole('switch', { name: /Seal Assist/ });
      assist.focus();
      expect(assist).toHaveFocus();
      owner = null;
      // Native browser exit has no accompanying DOM keydown on WebKit.
      fireEvent(document, new Event('webkitfullscreenchange'));
      expect(await menu.findByRole('button', { name: 'Enter full screen' })).toBeVisible();
      expect(assist).toHaveFocus();
    } finally {
      properties.forEach(([object, key], index) => {
        if (previous[index]) Object.defineProperty(object, key, previous[index]!);
        else Reflect.deleteProperty(object, key);
      });
    }
  });

  it('supports settings and keyboard dismissal without losing the current journey', async () => {
    fixture.save=createNewSave(); fixture.save.dialogue=null;
    mount(); await begin();
    const root=document.querySelector('.mesomon')!, position=[root.getAttribute('data-player-x'),root.getAttribute('data-player-y')];
    const trigger = screen.getByRole('button', { name: 'Start' });
    fireEvent.keyDown(window, { key: 'm' });
    const menu = within(screen.getByRole('dialog', { name: 'Start menu' }));
    expect(menu.getByRole('button', { name: 'Resume' })).toHaveFocus();
    fireEvent.keyDown(window, {key:'ArrowDown'});
    expect(menu.getByRole('button', {name:'Companions'})).toHaveFocus();
    fireEvent.keyDown(window, {key:'ArrowRight'});
    expect(menu.getByRole('button', {name:'Journal'})).toHaveFocus();
    fireEvent.keyDown(window, {key:'ArrowDown'});
    expect(menu.getByRole('button', {name:'Settings'})).toHaveFocus();
    fireEvent.keyDown(window, {key:'z'});
    const assist=menu.getByRole('switch',{name:/Seal Assist/});
    fireEvent.click(assist); expect(assist).toHaveAttribute('aria-checked','true');
    const mute=menu.getByRole('switch',{name:/Mute/});
    fireEvent.click(mute); expect(mute).toHaveAttribute('aria-checked',String(!fixture.save.settings.mute));
    fireEvent.keyDown(mute,{key:'Escape'});
    expect(menu.getByRole('button', {name:'Settings'})).toHaveFocus();
    fireEvent.keyDown(window,{key:'Escape'});
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
    expect(trigger).toHaveFocus();
    expect([root.getAttribute('data-player-x'),root.getAttribute('data-player-y')]).toEqual(position);
  });

  it('cleans every rendered canvas and audio owner when a Strict Mode route leaves', async () => {
    const mounted=mount(true); await begin();
    await waitFor(()=>expect(document.querySelectorAll('.mesomon canvas')).toHaveLength(1));
    mounted.unmount();
    await waitFor(()=>expect(document.querySelectorAll('.mesomon,canvas')).toHaveLength(0));
    expect(fixture.viewDestroy).toHaveBeenCalledTimes(fixture.viewCreate.mock.calls.length);
    expect(fixture.audioDestroy).toHaveBeenCalledTimes(fixture.audioCreate.mock.calls.length);
  });

  it('can mount the same local game with no authenticated user or club', async () => {
    render(<MemoryRouter><MesomonGame /></MemoryRouter>);
    await begin();
    expect(screen.getByRole('button',{name:'A — Confirm'})).toBeEnabled();
    expect(document.querySelector('.mm-save-status')).toBeNull();
    const menu = openStart();
    expect(menu.getByRole('status')).toHaveClass('mm-save-local');
    fireEvent.click(menu.getByRole('button', {name:'Save file'}));
    expect(menu.getByRole('status')).toHaveClass('mm-save-local');
    fixture.flush.mockClear();
    fireEvent.click(menu.getByRole('button', {name:'Save now'}));
    expect(fixture.flush).toHaveBeenCalled();
    expect(fixture.saveLocal).toHaveBeenCalled();
    fireEvent.click(menu.getByRole('button', {name:'Title screen'}));
    expect(screen.getByRole('button', {name:'Start'})).toHaveFocus();
    expect(screen.getByRole('button', {name:'File 1'})).toBeVisible();
  });

  it('adopts a cloud chapter that arrives after the title first rendered, before continuing',async()=>{
    const mounted=mount();await screen.findByRole('button',{name:/^Begin journey/});
    expect(document.querySelector('.mesomon')).toHaveAttribute('data-map-id','ship');
    const cloud=createNewSave();cloud.player={...cloud.player,mapId:'harbor',x:26,y:30};cloud.questFlags={captain_met:true,disembarked:true};
    fixture.save=cloud;
    mounted.rerender(<MemoryRouter><MesomonGame userId={USER} clubId={CLUB}/></MemoryRouter>);
    const resume=await screen.findByRole('button',{name:/^Continue journey/});
    await waitFor(()=>expect(document.querySelector('.mesomon')).toHaveAttribute('data-map-id','harbor'));
    fireEvent.click(resume);
    expect(document.querySelector('.mesomon')).toHaveAttribute('data-map-id','harbor');
    expect(fixture.saveLocal.mock.calls.at(-1)?.[0].player.mapId).toBe('harbor');
  });

  it('remembers title audio settings without creating a chapter save',async()=>{
    const mounted = mount();
    await screen.findByRole('button',{name:'Begin journey'});
    const titleMenu = openStart();
    fireEvent.click(titleMenu.getByRole('button', {name:'Save file'}));
    expect(titleMenu.queryByRole('button', {name:'Save now'})).toBeNull();
    fireEvent.click(titleMenu.getByRole('button', {name:'Back'}));
    fireEvent.click(titleMenu.getByRole('button', {name:'Settings'}));
    const mute = titleMenu.getByRole('switch', {name:/Mute/});
    expect(mute).toHaveAttribute('aria-checked','true');
    fireEvent.click(mute);
    expect(mute).toHaveAttribute('aria-checked','false');
    expect(fixture.saveLocal).not.toHaveBeenCalled();
    mounted.unmount();
    mount();
    await screen.findByRole('button',{name:'Begin journey'});
    const reopened = openStart();
    fireEvent.click(reopened.getByRole('button', {name:'Settings'}));
    expect(reopened.getByRole('switch', {name:/Mute/})).toHaveAttribute('aria-checked','false');
    expect(fixture.saveLocal).not.toHaveBeenCalled();
  });

  it('preserves the loaded renderer while reopening a blocked file and resuming its newer position', async () => {
    fixture.save = createNewSave();
    fixture.blocked = true;
    const mounted = mount();
    const refresh = () => mounted.rerender(<MemoryRouter><MesomonGame userId={USER} clubId={CLUB}/></MemoryRouter>);
    await waitFor(() => expect(document.querySelector('.mesomon canvas')).toBeInTheDocument());
    const canvas = document.querySelector('.mesomon canvas');
    fixture.reload.mockImplementationOnce(async () => {
      fixture.loading = true;
      fixture.save = null;
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reload file' }));
    refresh();
    expect(fixture.reload).toHaveBeenCalledOnce();
    expect(document.querySelector('.mesomon canvas')).toBe(canvas);

    fixture.loading = false;
    fixture.blocked = false;
    fixture.save = createNewSave();
    fixture.save.player.x = 9;
    refresh();
    await waitFor(() => expect(document.querySelector('.mesomon')).toHaveAttribute('data-player-x', '9'));
    await begin();
    expect(document.querySelector('.mesomon canvas')).toBe(canvas);
    expect(fixture.viewCreate).toHaveBeenCalledOnce();
    expect(fixture.viewDestroy).not.toHaveBeenCalled();
  });

  it('pauses an active journey and closes its menu when storage ownership becomes blocked',async()=>{
    fixture.save=createNewSave();
    const mounted=mount();await begin();
    const menu = openStart();
    fireEvent.click(menu.getByRole('button', {name:'Save file'}));
    fixture.blocked=true;fixture.blockReason='This file is open in another tab.';
    mounted.rerender(<MemoryRouter><MesomonGame userId={USER} clubId={CLUB}/></MemoryRouter>);
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
    const resume=await screen.findByRole('button',{name:/^Continue journey/});
    expect(resume).toBeDisabled();expect(screen.getByText(fixture.blockReason)).toBeVisible();
    expect(screen.getByRole('button',{name:'Start'})).toBeDisabled();
    expect(screen.getByRole('link',{name:'Exit game'})).toHaveAttribute('href','/compete');
    const writes=fixture.saveLocal.mock.calls.length;
    fireEvent.click(resume);fireEvent.keyDown(document.body,{key:'ArrowUp'});fireEvent.keyUp(document.body,{key:'ArrowUp'});
    expect(fixture.saveLocal).toHaveBeenCalledTimes(writes);
    fireEvent.click(screen.getByRole('button',{name:'Reload file'}));
    await waitFor(()=>expect(fixture.reload).toHaveBeenCalledOnce());
  });
});
