import { useReducer } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNewSave, createSession, nearbyInteractions, reduceGame } from '@/lib/mesomon/engine';
import { useTapWalk } from '@/lib/mesomon/useTapWalk';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

function openDeck() {
  const notice = vi.fn();
  return renderHook(({ active }) => {
    const [session, dispatch] = useReducer(reduceGame, undefined, () => createSession(createNewSave()));
    const walk = useTapWalk(session, active, dispatch, notice);
    const stepLeft = () => { walk.cancel(); dispatch({ type: 'move', direction: 'left' }); };
    return { session, walk, stepLeft, notice };
  }, { initialProps: { active: true } });
}
const advance = () => act(() => { vi.advanceTimersByTime(150); });

describe('walking across the live map by touch', () => {
  it('approaches and faces a person, then waits for a second tap before speaking', () => {
    const { result } = openDeck();
    const captain = { x: 8, y: 5 };
    act(() => result.current.walk.tap(captain, 'captain'));
    for (let n = 0; n < 5; n++) advance();
    expect(result.current.session.save.player).toMatchObject({ x: 8, y: 6, facing: 'up' });
    expect(result.current.session.dialogue).toBeNull();
    expect(nearbyInteractions(result.current.session.save)[0].id).toBe('captain');
    act(() => result.current.walk.tap(captain, 'captain'));
    expect(result.current.session.dialogue?.id).toBe('captain');
  });

  it('manual movement cancels travel and closing the chart never restarts a former route', () => {
    const { result, rerender } = openDeck();
    act(() => result.current.walk.tap({ x: 8, y: 6 }));
    advance();
    act(() => result.current.stepLeft());
    advance();
    expect(result.current.session.save.player).toMatchObject({ x: 7, y: 8 });
    act(() => result.current.walk.tap({ x: 8, y: 6 }));
    rerender({ active: false });
    advance();
    rerender({ active: true });
    advance();
    expect(result.current.session.save.player).toMatchObject({ x: 7, y: 8 });
  });

  it('leaves the player on deck when the tapped ground is water', () => {
    const { result } = openDeck();
    act(() => result.current.walk.tap({ x: 0, y: 9 }));
    advance();
    expect(result.current.notice).toHaveBeenCalledWith('No path to that spot.');
    expect(result.current.session.save.player).toMatchObject({ x: 8, y: 9 });
  });
});
