import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

describe('Mesomon game shell', () => {
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
    mount(); await begin();
    fireEvent.click(screen.getByRole('button',{name:'A — Confirm'}));
    const conversation=await screen.findByRole('region',{name:'Conversation'});
    expect(within(conversation).getByText('Captain',{exact:true})).toBeVisible();
    expect(within(conversation).getByText('Port Marche.',{exact:true})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'A — Confirm'}));
    expect(within(conversation).getByRole('button',{name:'Continue'})).toBeVisible();
  });

  it('supports settings and keyboard dismissal without losing the current journey', async () => {
    fixture.save=createNewSave(); fixture.save.dialogue=null;
    mount(); await begin();
    const root=document.querySelector('.mesomon')!, position=[root.getAttribute('data-player-x'),root.getAttribute('data-player-y')];
    fireEvent.click(screen.getByRole('button',{name:'Menu'}));
    const menu=await screen.findByRole('dialog',{name:'Game menu'});
    fireEvent.click(within(menu).getByRole('button',{name:/^Settings$/}));
    const assist=within(menu).getByRole('switch',{name:/Seal Assist/});
    fireEvent.click(assist); expect(assist).toHaveAttribute('aria-checked','true');
    const mute=within(menu).getByRole('switch',{name:/Mute/});
    fireEvent.click(mute); expect(mute).toHaveAttribute('aria-checked',String(!fixture.save.settings.mute));
    fireEvent.keyDown(mute,{key:'Escape'});
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
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
    expect(document.querySelector('.mm-save-local')).toBeVisible();
    expect(fixture.saveLocal).toHaveBeenCalled();
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

  it('remembers title audio preferences without creating an empty economic save',async()=>{
    const mounted=mount();await screen.findByRole('button',{name:/^Begin journey/});
    fireEvent.click(screen.getByRole('button',{name:'Unmute audio'}));
    expect(screen.getByRole('button',{name:'Mute audio'})).toBeVisible();
    expect(fixture.saveLocal).not.toHaveBeenCalled();
    mounted.unmount();mount();await screen.findByRole('button',{name:/^Begin journey/});
    expect(screen.getByRole('button',{name:'Mute audio'})).toBeVisible();
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
    fireEvent.click(screen.getByRole('button',{name:'Menu'}));
    await screen.findByRole('dialog',{name:'Game menu'});
    fixture.blocked=true;fixture.blockReason='This file is open in another tab.';
    mounted.rerender(<MemoryRouter><MesomonGame userId={USER} clubId={CLUB}/></MemoryRouter>);
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
    const resume=await screen.findByRole('button',{name:/^Continue journey/});
    expect(resume).toBeDisabled();expect(screen.getByText(fixture.blockReason)).toBeVisible();
    const writes=fixture.saveLocal.mock.calls.length;
    fireEvent.click(resume);fireEvent.keyDown(document.body,{key:'ArrowUp'});fireEvent.keyUp(document.body,{key:'ArrowUp'});
    expect(fixture.saveLocal).toHaveBeenCalledTimes(writes);
    fireEvent.click(screen.getByRole('button',{name:'Reload file'}));
    await waitFor(()=>expect(fixture.reload).toHaveBeenCalledOnce());
  });
});
