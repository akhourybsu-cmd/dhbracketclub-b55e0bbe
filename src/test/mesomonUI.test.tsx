import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PocketDevice } from '@/components/pocket/PocketHandheld';
import { MesomonGame } from '@/pages/MesomonPage';
import { createNewSave, createSession, getObjective, getQuestSteps, reduceGame } from '@/lib/mesomon/engine';
import { createBattle, makeCompanion, startBattleTurn } from '@/lib/mesomon/battle';
import { DIALOGUES } from '@/lib/mesomon/data/dialogue';
import type { MesomonSaveV1 } from '@/lib/mesomon/types';

const fixture = vi.hoisted(() => ({
  save: null as MesomonSaveV1 | null,
  deleteSave: vi.fn(async () => {}),
  saveLocal: vi.fn(), flush: vi.fn(async () => {}), retry: vi.fn(async () => {}), reload: vi.fn(async () => {}),
  useCloud: vi.fn(async () => {}), keepLocal: vi.fn(async () => {}),
  viewCreate: vi.fn(), viewDestroy: vi.fn(), audioCreate: vi.fn(), audioDestroy: vi.fn(), audioCue: vi.fn(),
  blocked:false,blockReason:'',loading:false,
  delayFirstFrame: false,
  firstFrame: undefined as (() => void) | undefined,
  artFailure: undefined as (() => void) | undefined,
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'test-user' }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: 'test-club' }, loading: false }) }));
vi.mock('@/hooks/useClubAssets', () => ({ useClubAssets: () => ({ loading: false, isInstalled: () => true }) }));
vi.mock('@/hooks/useMesomonSave', () => ({ useMesomonSave: () => ({
  save: fixture.save, loading: fixture.loading, status: 'local', error: null, conflict: null,
  saveLocal: fixture.saveLocal, flush: fixture.flush, retry: fixture.retry, reload: fixture.reload,
  useCloud: fixture.useCloud, keepLocal: fixture.keepLocal, deleteSave: fixture.deleteSave, deleting: false,
  blocked:fixture.blocked,blockReason:fixture.blockReason,
}) }));
vi.mock('@/lib/mesomon/renderer/createGame', () => ({
  createMesomonView: async (parent: HTMLElement, options: { signal?: AbortSignal; onFirstFrame?: () => void; onError?: (error: string) => void }) => {
    fixture.viewCreate();
    const canvas = document.createElement('canvas'); canvas.width=160;canvas.height=144;
    if (!options.signal?.aborted) parent.appendChild(canvas);
    let drewFrame = false;
    const drawFrame = () => {
      if (!drewFrame && !options.signal?.aborted) {
        drewFrame = true;
        options.onFirstFrame?.();
      }
    };
    return { update: () => {
      fixture.firstFrame = drawFrame;
      fixture.artFailure = () => options.onError?.('The artwork could not load.');
      if (!fixture.delayFirstFrame) drawFrame();
    }, pause: vi.fn(), sealAccuracy: () => 1,
      destroy: () => { fixture.viewDestroy(); canvas.remove(); } };
  },
}));
vi.mock('@/lib/mesomon/audio', () => ({ MesomonAudio: class {
  constructor() { fixture.audioCreate(); }
  unlock = async () => {};
  setSettings = vi.fn(); setScene = vi.fn(); cue = fixture.audioCue; battleBeat = vi.fn(); pause = vi.fn();
  destroy = () => fixture.audioDestroy();
} }));

beforeEach(() => {
  fixture.delayFirstFrame = false; fixture.firstFrame = undefined; fixture.artFailure = undefined;
  vi.clearAllMocks(); fixture.save=null;fixture.blocked=false;fixture.blockReason='';fixture.loading=false;localStorage.clear();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const USER='11111111-1111-4111-8111-111111111111', CLUB='22222222-2222-4222-8222-222222222222';
function mount(strict=false) {
  const game=<MemoryRouter><MesomonGame userId={USER} clubId={CLUB} /></MemoryRouter>;
  return render(strict?<StrictMode>{game}</StrictMode>:game);
}
async function begin() {
  const journey = await screen.findByRole('button', {name: /^(Begin|Continue) journey$/});
  const isNew = journey.textContent?.includes('Begin');
  fireEvent.click(journey);
  if (isNew) fireEvent.click(await screen.findByRole('button', {name: 'Skip opening'}));
  await waitFor(() => expect(fixture.firstFrame).toBeDefined());
}
function openStart() {
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  return within(screen.getByRole('dialog', { name: 'Start menu' }));
}

describe('Mesomon game shell', () => {
  it('sounds the cuff and bond once per encounter while successive saved lines hold the same shot', async () => {
    const file = createNewSave();
    const lines = DIALOGUES['first-bond'];
    file.settings.reducedMotion = true;
    file.questFlags.gate_opened = true;
    file.player = { ...file.player, mapId: 'tide-stairs', x: 13, y: 12 };
    file.dialogue = { id: 'first-bond', lines, index: 0, onFinish: 'first-bond' };
    fixture.save = file;
    mount();
    await begin();
    const sceneCues = () => fixture.audioCue.mock.calls.map(([cue]) => cue).filter(cue => ['cuff-answer', 'bond'].includes(cue));
    const expected: string[] = [];
    for (const [index, line] of lines.entries()) {
      expect(document.querySelector('[data-bond-shot]')).toHaveAttribute('data-bond-shot', line.bondShot);
      if (line.bondShot !== lines[index - 1]?.bondShot) {
        if (line.bondShot === 'glow') expected.push('cuff-answer');
        if (line.bondShot === 'bond') expected.push('bond');
      }
      expect(sceneCues()).toEqual(expected);
      fireEvent.click(screen.getByRole('button', {name:'Continue'}));
    }
    expect(document.querySelector('[data-bond-shot]')).toBeNull();
    expect(fixture.saveLocal.mock.calls.at(-1)?.[0].party.map((member: { id: string }) => member.id)).toEqual(['rillik-first']);
    expect(sceneCues()).toEqual(['cuff-answer', 'bond']);
  });

  it.each(['first frame', 'art failure'])('holds a restored battle for the %s, even under keyboard and touch input', async ready => {
    const file = createNewSave();
    const member = makeCompanion('rillik');
    file.party = [member];
    file.collection[member.id] = member;
    file.battle = startBattleTurn(createBattle(file.party, 'muddren'), { type: 'move', moveId: 'brine-snap' }, {});
    const [first, impact] = file.battle.playback!.beats;
    fixture.save = file;
    fixture.delayFirstFrame = true;
    mount();
    await begin();
    vi.useFakeTimers();
    try {
      const battle = within(screen.getByRole('region', { name: 'Battle' }));
      const next = battle.getByRole('button', { name: 'Next' });
      expect(next).toBeDisabled();
      fireEvent.click(next);
      fireEvent.keyDown(window, { key: 'z' });
      fireEvent.keyDown(window, { key: 'Enter' });
      act(() => vi.advanceTimersByTime(7000));
      expect(battle.getByRole('status')).toHaveTextContent(first.text);
      expect(fixture.saveLocal.mock.calls.at(-1)?.[0].battle.playback.index).toBe(0);
      act(() => ready === 'first frame' ? fixture.firstFrame!() : fixture.artFailure!());
      expect(next).toBeEnabled();
      fireEvent.keyDown(next, { key: 'z' });
      expect(battle.getByRole('status')).toHaveTextContent(impact.text);
    } finally { vi.useRealTimers(); }
  });

  it('keeps battle moves locked until the first frame', async () => {
    const file = createNewSave();
    const member = makeCompanion('rillik');
    file.party = [member];
    file.collection[member.id] = member;
    file.battle = createBattle(file.party, 'muddren');
    fixture.save = file;
    fixture.delayFirstFrame = true;
    mount();
    await begin();
    const battle = within(screen.getByRole('region', { name: 'Battle' }));
    const move = battle.getByRole('button', { name: /Brine Snap/ });
    expect(move).toBeDisabled();
    fireEvent.click(move);
    fireEvent.keyDown(window, { key: 'z' });
    expect(fixture.saveLocal.mock.calls.at(-1)?.[0].battle.turn).toBe(0);
    act(() => fixture.firstFrame!());
    expect(move).toBeEnabled();
  });

  it('holds a saved walk-in behind the cover until the first frame', async () => {
    const file = createNewSave();
    file.player = { ...file.player, x: 8, y: 10, facing: 'down' };
    file.questFlags.captain_met = true;
    const arrival = reduceGame(createSession(file), { type: 'interact', id: 'gangplank' }).save;
    const initialSteps = arrival.dialogue!.approach!.steps.length;
    fixture.save = arrival;
    fixture.delayFirstFrame = true;
    mount();
    await begin();
    vi.useFakeTimers();
    try {
      fireEvent.keyDown(window, { key: 'z' });
      act(() => vi.advanceTimersByTime(7000));
      expect(fixture.saveLocal.mock.calls.at(-1)?.[0].dialogue.approach.steps).toHaveLength(initialSteps);
      act(() => fixture.firstFrame!());
      act(() => vi.advanceTimersByTime(200));
      expect(fixture.saveLocal.mock.calls.at(-1)?.[0].dialogue.approach.steps).toHaveLength(initialSteps - 1);
    } finally { vi.useRealTimers(); }
  });

  it('adopts the device motion preference for a new journey and remembers a player override', async () => {
    const matchMedia = window.matchMedia;
    vi.stubGlobal('matchMedia', (query: string) => ({ ...matchMedia(query), matches: query === '(prefers-reduced-motion: reduce)' }));
    const first = mount();
    await screen.findByRole('button', { name: 'Begin journey' });
    fireEvent.click(screen.getByRole('button', {name: 'Settings'}));
    const menu = within(screen.getByRole('dialog', {name: 'Settings'}));
    const motion = menu.getByRole('switch', { name: /Reduced motion/ });
    expect(motion).toHaveAttribute('aria-checked', 'true');
    expect(document.querySelector('.mesomon')).toHaveAttribute('data-reduced-motion', 'true');
    fireEvent.click(motion);
    first.unmount();
    mount();
    await begin();
    expect(document.querySelector('.mesomon')).not.toHaveAttribute('data-reduced-motion');
    expect(fixture.saveLocal.mock.calls.at(-1)?.[0].settings.reducedMotion).toBe(false);
  });

  it('starts a restored conversation on entering the field and shows full lines with reduced motion', async () => {
    const save = createNewSave();
    save.player = { ...save.player, x: 8, y: 6, facing: 'up' };
    fixture.save = reduceGame(createSession(save), { type: 'interact', id: 'captain' }).save;
    const lines = fixture.save.dialogue!.lines;
    mount();
    const enter = await screen.findByRole('button', { name: 'Continue journey' });
    await waitFor(() => expect(fixture.firstFrame).toBeDefined());
    vi.useFakeTimers();
    try {
      act(() => vi.advanceTimersByTime(3000));
      fireEvent.click(enter);
      const visibleLine = () => document.querySelector('.mm-dialogue-text > [aria-hidden="true"]');
      expect(visibleLine()?.textContent).toBe('');
      act(() => vi.advanceTimersByTime(24));
      expect(visibleLine()?.textContent).toBe(lines[0].text.slice(0, 2));
      const menu = openStart();
      fireEvent.click(menu.getByRole('button', { name: 'Settings' }));
      fireEvent.click(menu.getByRole('switch', { name: /Reduced motion/ }));
      fireEvent.click(menu.getByRole('button', { name: 'Back' }));
      fireEvent.click(menu.getByRole('button', { name: 'Resume' }));
      expect(visibleLine()).toHaveTextContent(lines[0].text);
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      expect(visibleLine()).toHaveTextContent(lines[1].text);
    } finally { vi.useRealTimers(); }
  });

  it('pauses the current attack in Start and resumes the next impact through the keyboard', async () => {
    fixture.save = createNewSave();
    const member = makeCompanion('rillik');
    fixture.save.party = [member];
    fixture.save.collection[member.id] = member;
    fixture.save.battle = createBattle([member], 'muddren');
    mount();
    await begin();
    vi.useFakeTimers();
    try {
      const battle = within(screen.getByRole('region', { name: 'Battle' }));
      const move = battle.getByRole('button', { name: /Brine Snap/ });
      move.focus();
      fireEvent.keyDown(move, { key: 'z' });
      const meter = battle.getByRole('meter', { name: 'Muddren HP' });
      const hp = meter.getAttribute('aria-valuenow');
      const cue = battle.getByRole('status').textContent;
      const menu = openStart();
      act(() => vi.advanceTimersByTime(10000));
      fireEvent.click(menu.getByRole('button', { name: 'Resume' }));
      expect(battle.getByRole('status')).toHaveTextContent(cue!);
      expect(meter).toHaveAttribute('aria-valuenow', hp);
      fireEvent.keyDown(screen.getByRole('button', { name: 'Start' }), { key: 'ArrowRight' });
      const next = battle.getByRole('button', { name: 'Next' });
      expect(next).toHaveFocus();
      fireEvent.keyDown(next, { key: 'z' });
      expect(battle.getByRole('status')).toHaveTextContent(/Muddren loses/);
      expect(Number(meter.getAttribute('aria-valuenow'))).toBeLessThan(Number(hp));
    } finally {
      vi.useRealTimers();
    }
  });
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
    fireEvent.click(fieldcase.getByRole('button', {name: 'Field Guide'}));
    expect(fieldcase.getByRole('heading', {name: 'No sightings yet'})).toBeVisible();
    fireEvent.click(fieldcase.getByRole('button', {name: 'Back'}));
    expect(fieldcase.getByRole('button', {name: 'Field Guide'})).toHaveFocus();
    fireEvent.click(fieldcase.getByRole('button', {name: 'Journal'}));
    const entries = getQuestSteps(fixture.save).filter(step => step.complete);
    expect(entries.map(step => step.id)).toEqual(['captain_met', 'disembarked']);
    const notes = fieldcase.getAllByRole('listitem');
    expect(notes).toHaveLength(entries.length);
    entries.forEach((step, index) => expect(notes[index]).toHaveTextContent(step.label));
    expect(fieldcase.getByText(getObjective(fixture.save))).toBeVisible();
    expect(fieldcase.queryByText(/Wretch|sealed rift|upper channel/i)).toBeNull();
    expect(fieldcase.queryByRole('heading', { name: 'On the quay' })).toBeNull();
  });
  it('shows the individual companion’s combat stats in the fieldcase', async () => {
    fixture.save = createNewSave();
    const member = makeCompanion('rillik');
    Object.assign(member, { power: 16, guard: 14, agility: 17, resonance: 20 });
    fixture.save.party = [member];
    fixture.save.collection[member.id] = member;
    mount();
    await begin();
    const menu = openStart();
    fireEvent.click(menu.getByRole('button', {name: 'Companions'}));
    const stats = menu.getByLabelText('Battle stats');
    expect(Array.from(stats.querySelectorAll('div'), cell => cell.textContent)).toEqual([
      'Attack16', 'Defense14', 'Speed17', 'Resonance20',
    ]);
    fireEvent.click(menu.getByRole('button', { name: 'Release Rillik beside you' }));
    expect(fixture.saveLocal.mock.calls.at(-1)?.[0].questFlags.companion_released).toBe(true);
    fireEvent.click(menu.getByRole('button', { name: 'Call Rillik to the crystal' }));
    expect(fixture.saveLocal.mock.calls.at(-1)?.[0].questFlags.companion_released).toBe(false);
  });
  it('keeps the Companions meter in step with a paused exchange', async () => {
    const file = createNewSave();
    const member = makeCompanion('rillik');
    file.party = [member];
    file.collection[member.id] = member;
    const battle = createBattle(file.party, 'tressel');
    file.battle = startBattleTurn(battle, { type: 'guard' }, {});
    expect(file.battle.allies[0].vitality).toBeLessThan(member.vitality);
    fixture.save = file;
    mount();
    await begin();
    const menu = openStart();
    fireEvent.click(menu.getByRole('button', { name: 'Companions' }));
    expect(menu.getByRole('meter', { name: 'Rillik vitality' })).toHaveAttribute('value', String(member.vitality));
    expect(menu.queryByRole('button', { name: /Release Rillik|Call Rillik/ })).toBeNull();
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
  it('keeps the cartridge title in the LCD and operates its save files with the physical controls', async () => {
    const eject = vi.fn();
    render(<MemoryRouter><PocketDevice onClose={vi.fn()}>
      <MesomonGame userId={USER} clubId={CLUB} onExitPocketGame={eject} />
    </PocketDevice></MemoryRouter>);
    const journey = await screen.findByRole('button', { name: 'Begin journey' });
    expect(journey.closest('.pocket-lcd')).toBeVisible();
    const dpad = () => within(screen.getByRole('group', { name: 'Browse save files' }));
    fireEvent.click(dpad().getByRole('button', { name: 'Browse right' }));
    expect(await screen.findByRole('button', { name: 'File 2', pressed: true })).toHaveFocus();
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    await screen.findByRole('button', { name: 'File 1', pressed: true });
    fireEvent.click(screen.getByRole('button', { name: 'A — Begin journey' }));
    expect(await screen.findByRole('button', { name: 'Skip opening' })).toBeVisible();
    expect(document.querySelectorAll('.mm-device')).toHaveLength(1);
    expect(eject).not.toHaveBeenCalled();
  });

  it.each(['title', 'Start menu', 'save recovery', 'save loading', 'power switch'])(
    'ejects or powers down the hosted cartridge from %s', async surface => {
      const close = vi.fn(), eject = vi.fn();
      fixture.blocked = surface === 'save recovery';
      fixture.loading = surface === 'save loading';
      render(
        <MemoryRouter>
          <PocketDevice onClose={close}>
            <MesomonGame userId={USER} clubId={CLUB} onExitPocketGame={eject} />
          </PocketDevice>
        </MemoryRouter>,
      );
      expect(document.querySelectorAll('.mm-device')).toHaveLength(1);
      if (surface === 'Start menu' || surface === 'power switch') {
        await begin();
        if (surface === 'Start menu') openStart();
        fixture.saveLocal.mockClear();
        fixture.flush.mockClear();
      } else if (surface !== 'save loading') {
        await screen.findByRole('button', { name: 'Begin journey' });
      }
      if (surface === 'power switch') {
        fireEvent.click(screen.getByRole('button', { name: 'Close handheld and return to DH Club' }));
        expect(close).toHaveBeenCalledTimes(1);
        expect(eject).not.toHaveBeenCalled();
      } else {
        fireEvent.click(await screen.findByRole('button', { name: 'Exit game' }));
        expect(eject).toHaveBeenCalledTimes(1);
        expect(close).not.toHaveBeenCalled();
      }
      if (surface === 'Start menu' || surface === 'power switch') {
        expect(fixture.saveLocal).toHaveBeenCalled();
        expect(fixture.flush).toHaveBeenCalled();
      } else {
        expect(fixture.saveLocal).not.toHaveBeenCalled();
      }
    },
  );
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
    expect(screen.getByRole('link', exit)).toHaveAttribute('href', '/compete');
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    fireEvent.keyDown(window, { key: 'm' });
    expect(screen.queryByRole('dialog')).toBeNull();
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

  it('opens a fresh file at sea and reaches the ship after the final shot', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', {name: 'Begin journey'}));
    const cinematic = await screen.findByRole('dialog', {name: 'Opening cinematic'});
    expect(cinematic).toHaveAttribute('data-shot', 'sea');
    expect(screen.queryByRole('button', {name: 'Start'})).toBeNull();
    fireEvent.keyDown(window, {key: 'm'});
    expect(screen.queryByRole('dialog', {name: 'Start menu'})).toBeNull();
    const next = within(cinematic).getByRole('button', {name: 'Next scene'});
    fireEvent.click(next);
    expect(cinematic).toHaveAttribute('data-shot', 'letter');
    fireEvent.click(within(cinematic).getByRole('button', {name: 'Next scene'}));
    expect(cinematic).toHaveAttribute('data-shot', 'quay');
    fireEvent.click(within(cinematic).getByRole('button', {name: 'Arrive at Port Marche'}));
    expect(screen.queryByRole('dialog', {name: 'Opening cinematic'})).toBeNull();
    expect(screen.getByRole('button', {name: 'Start'})).toBeEnabled();
    expect(fixture.saveLocal.mock.calls.at(-1)?.[0].player.mapId).toBe('ship');
  });

  it('continues an interrupted opening on the same saved ship without replaying it', async () => {
    const mounted = mount();
    fireEvent.click(await screen.findByRole('button', {name: 'Begin journey'}));
    await screen.findByRole('dialog', {name: 'Opening cinematic'});
    const embarked = fixture.saveLocal.mock.calls.at(-1)?.[0];
    expect(embarked?.player.mapId).toBe('ship');
    mounted.unmount();
    fixture.save = embarked;
    mount();
    fireEvent.click(await screen.findByRole('button', {name: 'Continue journey'}));
    expect(screen.queryByRole('dialog', {name: 'Opening cinematic'})).toBeNull();
    expect(screen.getByRole('button', {name: 'Start'})).toBeEnabled();
    const resumed = fixture.saveLocal.mock.calls.at(-1)?.[0];
    expect(resumed.journeySeed).toBe(embarked.journeySeed);
    expect(resumed.player).toEqual(embarked.player);
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
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(shell).toHaveAttribute('data-player-x', '7');
      fireEvent.keyDown(window, { key: 'ArrowLeft', repeat: true });
      act(() => vi.advanceTimersByTime(199));
      expect(shell).toHaveAttribute('data-player-x', '7');
      act(() => vi.advanceTimersByTime(1));
      expect(shell).toHaveAttribute('data-player-x', '6');
      fireEvent.keyUp(window, { key: 'ArrowLeft' });
      fireEvent.keyDown(window, { key: 'ArrowLeft', repeat: true });
      act(() => vi.advanceTimersByTime(400));
      expect(shell).toHaveAttribute('data-player-x', '6');
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns Z to the remembered battle command after resuming from Start', async () => {
    const file = createNewSave();
    const member = makeCompanion('rillik');
    file.party = [member];
    file.collection[member.id] = member;
    file.battle = createBattle(file.party, 'muddren');
    fixture.save = file;
    mount();
    await begin();
    const battle = within(screen.getByRole('region', { name: 'Battle' }));
    fireEvent.click(battle.getByRole('button', { name: 'Guard' }));
    const beats = fixture.saveLocal.mock.calls.at(-1)?.[0].battle.playback.beats;
    expect(beats.length).toBeGreaterThan(0);
    for (let i = 0; i < beats.length; i++) fireEvent.click(battle.getByRole('button', { name: 'Next' }));
    expect(battle.getByRole('button', { name: 'Guard' })).toHaveFocus();
    const menu = openStart();
    fireEvent.click(menu.getByRole('button', { name: 'Resume' }));
    const start = screen.getByRole('button', { name: 'Start' });
    expect(start).toHaveFocus();
    fireEvent.keyDown(start, { key: 'z' });
    expect(battle.getByRole('button', { name: 'Next' })).toHaveFocus();
    expect(fixture.saveLocal.mock.calls.at(-1)?.[0].battle.turn).toBe(2);
    expect(fixture.saveLocal.mock.calls.at(-1)?.[0].battle.guarded).toBe(true);
  });

  it('keeps native Enter and Space from repeating across Start, and honors hardware confirm on a focused D-pad', async () => {
    fixture.save = createNewSave();
    fixture.save.player = { ...fixture.save.player, x: 8, y: 6, facing: 'up' };
    fixture.save.settings.textSpeed = 'fast';
    mount();
    await begin();
    const menu = openStart();
    const resume = menu.getByRole('button', { name: 'Resume' });
    for (const key of ['Enter', ' ']) expect(fireEvent.keyDown(resume, { key, repeat: true })).toBe(false);
    fireEvent.click(resume);
    const start = screen.getByRole('button', { name: 'Start' });
    expect(fireEvent.keyDown(start, { key: 'Enter', repeat: true })).toBe(false);
    expect(fireEvent.keyDown(start, { key: 'ArrowLeft', altKey: true })).toBe(true);
    const direction = screen.getByRole('button', { name: 'Move left' });
    direction.focus();
    fireEvent.keyDown(direction, { key: 'z' });
    expect(screen.getByRole('region', { name: 'Conversation' })).toHaveTextContent('Captain');
    expect(fixture.saveLocal.mock.calls.at(-1)?.[0].player.x).toBe(8);
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
    expect(conversation.querySelector('[aria-live="polite"]')?.textContent).toBe(DIALOGUES.captain[0].text);
    const start = openStart();
    fireEvent.click(start.getByRole('button', {name:'Map'}));
    expect(start.getByRole('region', {name:'Location chart'})).toBeVisible();
    fireEvent.keyDown(window, {key:'m'});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(conversation.querySelector('[aria-live="polite"]')?.textContent).toBe(DIALOGUES.captain[0].text);
    const startKey = screen.getByRole('button', {name:'Start'});
    expect(startKey).toHaveFocus();
    fireEvent.keyDown(startKey, {key:'z'});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(conversation.querySelector('[aria-live="polite"]')?.textContent).toBe(DIALOGUES.captain[1].text);
    expect(within(conversation).getByRole('button',{name:'Continue'})).toBeVisible();
  });

  it('lets Nia walk up from the pier, wait while Start is open, and speak without a tap', async () => {
    fixture.save = createNewSave();
    fixture.save.player = { ...fixture.save.player, x: 8, y: 10, facing: 'down' };
    fixture.save.questFlags.captain_met = true;
    fixture.save.settings.textSpeed = 'fast';
    mount();
    await begin();
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    try {
      fireEvent.click(screen.getByRole('button', {name: /Go ashore/}));
      expect(screen.getByText('Nia approaches.')).toBeVisible();
      fireEvent.keyDown(window, {key:'z'});
      expect(screen.getByText('Nia approaches.')).toBeVisible();
      act(() => vi.advanceTimersByTime(200));
      const start = openStart();
      act(() => vi.advanceTimersByTime(1000));
      expect(fixture.saveLocal.mock.calls.at(-1)?.[0].dialogue.approach.steps).toHaveLength(1);
      fireEvent.click(start.getByRole('button', {name:'Resume'}));
      act(() => vi.advanceTimersByTime(200));
      const conversation = screen.getByRole('region', {name:'Conversation'});
      expect(within(conversation).getByText('Nia', {exact:true})).toBeVisible();
      expect(within(conversation).getByRole('button', {name:'Continue'})).toBeVisible();
      expect(fixture.saveLocal.mock.calls.at(-1)?.[0].questFlags.nia_met).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
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
    expect(menu.queryByRole('button', {name: /again|erase|delete|replace|restart/i})).toBeNull();
    fixture.flush.mockClear();
    fireEvent.click(menu.getByRole('button', {name:'Save now'}));
    expect(fixture.flush).toHaveBeenCalled();
    expect(fixture.saveLocal).toHaveBeenCalled();
    fireEvent.click(menu.getByRole('button', {name:'Title screen'}));
    expect(screen.queryByRole('button', {name:'Start'})).toBeNull();
    expect(screen.getByRole('button', {name:'File 1'})).toBeVisible();
  });

  it('keeps a failed deletion recoverable on the title and opens a fresh journey after a successful retry', async () => {
    fixture.save = createNewSave();
    fixture.save.player.mapId = 'harbor';
    fixture.save.playtimeSeconds = 120;
    fixture.deleteSave.mockRejectedValueOnce(new Error('Reconnect to delete this file.'))
      .mockImplementationOnce(async () => { fixture.save = null; });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete File 1' }));
    const prompt = within(screen.getByRole('alertdialog', { name: 'Delete File 1?' }));
    expect(prompt.getByRole('button', { name: 'Keep file' })).toHaveFocus();
    expect(prompt.getByText(/2 min/)).toBeInTheDocument();
    fireEvent.click(prompt.getByRole('button', { name: 'Delete file' }));
    expect(await prompt.findByRole('alert')).toHaveTextContent('Reconnect');
    fireEvent.click(prompt.getByRole('button', { name: 'Delete file' }));
    const fresh = await screen.findByRole('button', { name: 'Begin journey' });
    await waitFor(() => expect(fresh).toHaveFocus());
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete File 1' })).toBeNull();
    expect(fixture.saveLocal).not.toHaveBeenCalled();
    fireEvent.click(fresh);
    expect(await screen.findByRole('dialog', { name: 'Opening cinematic' })).toBeVisible();
    expect(fixture.saveLocal.mock.calls.at(-1)?.[0].player.mapId).toBe('ship');
  });

  it('requires a fresh confirmation if the selected file changes while the dialog is open', async () => {
    fixture.save = createNewSave();
    const mounted = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete File 1' }));
    fixture.save = { ...fixture.save, playtimeSeconds: 45 };
    mounted.rerender(<MemoryRouter><MesomonGame userId={USER} clubId={CLUB}/></MemoryRouter>);
    const prompt = within(screen.getByRole('alertdialog'));
    fireEvent.click(prompt.getByRole('button', { name: 'Delete file' }));
    expect(await prompt.findByRole('alert')).toHaveTextContent('This file changed');
    expect(fixture.deleteSave).not.toHaveBeenCalled();
    fireEvent.click(prompt.getByRole('button', { name: 'Keep file' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete File 1' })).toHaveFocus());
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
    expect(screen.queryByRole('dialog', {name: 'Opening cinematic'})).toBeNull();
    expect(screen.getByRole('button', {name: 'Start'})).toBeVisible();
    expect(document.querySelector('.mesomon')).toHaveAttribute('data-map-id','harbor');
    expect(fixture.saveLocal.mock.calls.at(-1)?.[0].player.mapId).toBe('harbor');
  });

  it('remembers title audio settings without creating a chapter save',async()=>{
    const mounted = mount();
    await screen.findByRole('button',{name:'Begin journey'});
    expect(screen.queryByRole('button', {name:'Save file'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name:'Settings'}));
    const titleMenu = within(screen.getByRole('dialog', {name:'Settings'}));
    const mute = titleMenu.getByRole('switch', {name:/Mute/});
    expect(mute).toHaveAttribute('aria-checked','true');
    fireEvent.click(mute);
    expect(mute).toHaveAttribute('aria-checked','false');
    expect(fixture.saveLocal).not.toHaveBeenCalled();
    mounted.unmount();
    mount();
    await screen.findByRole('button',{name:'Begin journey'});
    fireEvent.click(screen.getByRole('button', {name:'Settings'}));
    const reopened = within(screen.getByRole('dialog', {name:'Settings'}));
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
    expect(screen.queryByRole('button',{name:'Start'})).toBeNull();
    expect(screen.getByRole('link',{name:'Exit game'})).toHaveAttribute('href','/compete');
    const writes=fixture.saveLocal.mock.calls.length;
    fireEvent.click(resume);fireEvent.keyDown(document.body,{key:'ArrowUp'});fireEvent.keyUp(document.body,{key:'ArrowUp'});
    expect(fixture.saveLocal).toHaveBeenCalledTimes(writes);
    fireEvent.click(screen.getByRole('button',{name:'Reload file'}));
    await waitFor(()=>expect(fixture.reload).toHaveBeenCalledOnce());
  });
});
