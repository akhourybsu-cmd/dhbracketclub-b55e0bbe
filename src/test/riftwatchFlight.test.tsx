import { StrictMode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RiftwatchPage from '@/pages/RiftwatchPage';
import { ArcadeInputs, readGamepad, keyInput } from '@/lib/riftwatch/controls';
import { INPUT } from '../../supabase/functions/_shared/arcade/rules';

const network = vi.hoisted(() => ({
  board: vi.fn(), start: vi.fn(), submit: vi.fn(), pause: vi.fn(), dispose: vi.fn(), render: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user:{id:'pilot'} }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club:{id:'harbor', name:'Harbor'} }) }));
vi.mock('@/lib/arcade/client', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/arcade/client')>(),
  startArcadeRun: network.start, submitArcadeRun: network.submit, getArcadeLeaderboard:network.board,
}));
vi.mock('@/lib/riftwatch/audio', () => ({ RiftwatchAudio: class {
  configure() {} title() {} unlock() {} play() {} update() {} results() {} cue() {}
  pause=network.pause; dispose=network.dispose;
} }));
vi.mock('@/lib/riftwatch/render', () => ({ drawRiftwatch:network.render,captureRiftwatchEvents:vi.fn() }));
const summaryBoard = {period:'all_time',entries:[],personalBest:null,totalMembers:0};
let frames = new Map<number, FrameRequestCallback>();
let next = 0;
let time = 0;
function frame(step=1000/60) {
  time += step;
  const queued = [...frames.values()];
  frames.clear();
  queued.forEach(callback => callback(time));
}
async function launch(name: string) {
  await act(async () => { fireEvent.click(screen.getByRole('button',{name})); });
  // Each ready beat renders before its successor starts.
  for (let i=0;i<3;i++) await act(async () => { await vi.advanceTimersByTimeAsync(325); });
  expect(document.querySelector('[data-rw-screen=playing]')).toBeTruthy();
}
function playToEnd() { act(() => { for (let i=0;i<15000 && frames.size;i++) frame(1000/30); }); }
function mount(practiceOnly=false) {
  const client = new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
  return render(<StrictMode><QueryClientProvider client={client}><RiftwatchPage onExitPocketGame={vi.fn()} practiceOnly={practiceOnly} /></QueryClientProvider></StrictMode>);
}
function showVisibility(hidden: boolean) {
  Object.defineProperty(document,'hidden',{value:hidden,configurable:true});
  document.dispatchEvent(new Event('visibilitychange'));
}
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers(); vi.clearAllMocks();
  network.board.mockResolvedValue(summaryBoard);
  network.start.mockResolvedValue({runId:'run',seed:'port-watch',expiresAt:'2030-01-01T00:00:00Z'});
  Object.defineProperty(navigator,'onLine',{value:true,configurable:true});
  frames = new Map(); time=0; next=0;
  vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{frames.set(++next,cb);return next;});
  vi.stubGlobal('cancelAnimationFrame',(id:number)=>{frames.delete(id);});
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({} as CanvasRenderingContext2D);
  Object.defineProperty(document,'hidden',{value:false,configurable:true});
});
afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers();
  Reflect.deleteProperty(document,'hidden'); Reflect.deleteProperty(navigator,'onLine');
});

describe('Riftwatch input ports', () => {
  it('merges held input, short fire taps and D-pad slides, including opposing devices', () => {
    const controls = new ArcadeInputs();
    controls.move('left');
    controls.touch(INPUT.fire,true); controls.touch(INPUT.fire,false);
    expect(controls.read()).toBe(INPUT.left|INPUT.fire);
    expect(controls.read()).toBe(INPUT.left);
    controls.move('right'); expect(controls.read()).toBe(INPUT.right);
    controls.set('keyboard',keyInput('KeyA')); expect(controls.read()).toBe(0);
    controls.clear(); expect(controls.read()).toBe(0);
  });
  it('maps standard stick, D-pad, fire, pulse and menu', () => {
    const buttons = Array.from({length:16},(_,i)=>({pressed:[9,1,0,12].includes(i)}));
    const pad = {buttons,axes:[-.8,0]} as unknown as Gamepad;
    expect(readGamepad(pad)).toMatchObject({ up:true,menu:true,mask:INPUT.left|INPUT.fire|INPUT.pulse });
    expect(readGamepad(undefined).mask).toBe(0);
  });
});

describe('Riftwatch flight deck', () => {
  it('flies offline in Practice, suppresses ranked traffic and destroys its only animation on exit', async () => {
    Object.defineProperty(navigator,'onLine',{value:false,configurable:true});
    const view = mount(true);
    expect(screen.queryByText('Ranked Run')).toBeNull();
    await launch('Practice');
    expect(frames.size).toBe(1);
    playToEnd();
    expect(screen.getByText('Practice score')).toBeInTheDocument();
    expect(network.start).not.toHaveBeenCalled(); expect(network.submit).not.toHaveBeenCalled();
    expect(network.board).not.toHaveBeenCalled();
    await launch('Practice'); view.unmount();
    expect(frames.size).toBe(0);
    expect(network.dispose).toHaveBeenCalled();
  });
  it('holds fire while a second finger slides the D-pad, then releases both controls', async () => {
    mount(true);
    await launch('Practice');
    const pad = screen.getByRole('group', {name:'Movement controls'});
    const fire = screen.getByRole('button', {name:'A — Fire'});
    const field = () => network.render.mock.lastCall[1];
    const pointer = (element: Element, type: string, id: number, x=100) => {
      const event = new MouseEvent(type, {bubbles:true, clientX:x, clientY:66});
      Object.defineProperties(event, {pointerId:{value:id}, pointerType:{value:'touch'}});
      fireEvent(element, event);
    };
    for (const [element,id] of [[pad,1],[fire,2]] as const) {
      Object.assign(element, {setPointerCapture:vi.fn(), hasPointerCapture:(value:number)=>value===id, releasePointerCapture:vi.fn()});
    }
    vi.spyOn(pad,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:132,height:132,right:132,bottom:132,x:0,y:0,toJSON:()=>({})});
    act(() => {
      pointer(screen.getByRole('button',{name:'Move left'}),'pointerdown',1,20);
      pointer(fire,'pointerdown',2);
      frame(); frame(); frame();
    });
    expect(field().input).toBe(INPUT.left|INPUT.fire);
    act(() => { pointer(pad,'pointermove',1,122); frame(); frame(); });
    expect(field().input).toBe(INPUT.right|INPUT.fire);
    act(() => { pointer(pad,'pointerup',1); pointer(fire,'lostpointercapture',2); frame(); frame(); });
    expect(field().input).toBe(0);
  });
  it('keeps the selected menu action when focus moves to the physical A key', () => {
    mount(true);
    const button=screen.getByRole('button',{name:'Settings'});
    const confirm=screen.getByRole('button',{name:'A — Confirm'});
    act(()=>{button.focus(); confirm.focus(); fireEvent.click(confirm);});
    expect(screen.getByRole('heading',{name:'Settings'})).toBeInTheDocument();
    const contrast=screen.getByRole('button',{name:/High contrast/});
    fireEvent.click(contrast);
    expect(contrast).toHaveAttribute('aria-pressed','true');
    fireEvent.keyDown(window,{key:'Escape',code:'Escape'});
    expect(screen.getByRole('heading',{name:'Riftwatch'})).toBeInTheDocument();
  });
  it('stops simulation and audio when hidden and resumes only after a deliberate tap', async () => {
    mount(); await launch('Practice');
    act(()=>frame());
    act(()=>showVisibility(true));
    expect(screen.getByRole('heading',{name:'Paused'})).toBeInTheDocument();
    expect(frames.size).toBe(0); const draws=network.render.mock.calls.length;
    act(()=>{showVisibility(false);frame(60_000);});
    expect(network.render).toHaveBeenCalledTimes(draws);
    await launch('Resume'); expect(frames.size).toBe(1);
    expect(network.pause).toHaveBeenCalled();
  });
  it('resumes a completed submission after remount and shows standings only after validation', async () => {
    network.submit.mockRejectedValueOnce(new Error('Connection interrupted'));
    const view=mount(); await launch('Ranked Run');
    fireEvent.keyDown(window,{key:' ',code:'Space'});
    act(()=>{frame();frame();});
    fireEvent.keyUp(window,{key:' ',code:'Space'});
    playToEnd();
    await act(async()=>{});
    expect(screen.getByText('Verification pending')).toBeInTheDocument();
    expect(screen.queryByText('Verified score')).toBeNull();
    const invocation=network.submit.mock.calls[0];
    expect(invocation[2].length).toBeGreaterThan(0);
    view.unmount(); mount();
    fireEvent.click(screen.getByRole('button',{name:'Verify last run'}));
    network.submit.mockResolvedValueOnce({ ...invocation[3],status:'verified',isPersonalBest:true,rank:1,personalBest:invocation[3].score,leaderboard:summaryBoard });
    await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Retry verification'}));});
    expect(network.submit.mock.calls[1]).toEqual(invocation);
    expect(screen.getByText('Verified score')).toBeInTheDocument();
    expect(screen.getByText('Club #1')).toBeInTheDocument();
    expect(network.start).toHaveBeenCalledTimes(1);
  });
});
