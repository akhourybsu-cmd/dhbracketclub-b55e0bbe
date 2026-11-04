import { afterEach, expect, it } from 'vitest';
import { resetDraftViewScroll } from '@/lib/draft/scroll';

afterEach(() => { document.body.replaceChildren(); });

function room(overflow: string) {
  const main = document.createElement('main');
  main.className = 'da-arena-main';
  main.style.overflowY = overflow;
  const panel = document.createElement('section');
  main.append(panel);
  document.body.append(main);
  main.scrollTop = 800;
  main.scrollLeft = 40;
  panel.scrollTop = 400;
  panel.scrollLeft = 240;
  return { main, panel };
}

it('brings a new mobile view back to its heading without changing the selected round position', () => {
  const { main, panel } = room('auto');
  resetDraftViewScroll(panel);
  expect(main.scrollTop).toBe(0);
  expect(panel.scrollTop).toBe(0);
  expect(main.scrollLeft).toBe(40);
  expect(panel.scrollLeft).toBe(240);
});

it('resets only the desktop pane and tolerates an unmounted room', () => {
  const { main, panel } = room('hidden');
  resetDraftViewScroll(panel);
  expect(main.scrollTop).toBe(800);
  expect(panel.scrollTop).toBe(0);
  expect(() => resetDraftViewScroll(null)).not.toThrow();
});
