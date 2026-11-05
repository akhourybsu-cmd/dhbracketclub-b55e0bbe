import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindDraftViewport, measureDraftViewport } from '@/lib/draft/viewport';

let viewport: EventTarget & { height: number; width: number; offsetTop: number; offsetLeft: number };
let frames: Map<number, FrameRequestCallback>;
let release: (() => void) | undefined;
let previousViewport: PropertyDescriptor | undefined;
let previousStyle: string;

function flush() {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach(callback => callback(16));
}

beforeEach(() => {
  previousViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
  previousStyle = document.documentElement.style.cssText;
  viewport = Object.assign(new EventTarget(), { height: 700, width: 390, offsetTop: 0, offsetLeft: 0 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  frames = new Map();
  let next = 0;
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
    frames.set(++next, callback);
    return next;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
});
afterEach(() => {
  release?.(); release = undefined;
  document.body.replaceChildren();
  document.documentElement.style.cssText = previousStyle;
  document.documentElement.removeAttribute('data-da-short-viewport');
  document.documentElement.removeAttribute('data-da-tiny-viewport');
  if (previousViewport) Object.defineProperty(window, 'visualViewport', previousViewport);
  else Reflect.deleteProperty(window, 'visualViewport');
  vi.restoreAllMocks();
});

describe('Draft typing viewport', () => {
  it('uses the panned visible rectangle rather than its bottom edge or layout height', () => {
    expect(measureDraftViewport({ height: 260, width: 320, offsetTop: 82.5, offsetLeft: 12 }, { height: 844, width: 390 }))
      .toEqual({ top: 82.5, left: 12, height: 260, width: 320 });
    expect(measureDraftViewport(undefined, { height: 844, width: 390 })).toEqual({ top: 0, left: 0, height: 844, width: 390 });
  });

  it('coalesces resize and pan events and retains the last valid rectangle during keyboard animation', () => {
    release = bindDraftViewport();
    Object.assign(viewport, { height: 210, offsetTop: 35 });
    viewport.dispatchEvent(new Event('resize'));
    Object.assign(viewport, { offsetTop: 48, offsetLeft: 4, width: 380 });
    viewport.dispatchEvent(new Event('scroll'));
    expect(frames.size).toBe(1);
    flush();
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--da-viewport-top')).toBe('48px');
    expect(style.getPropertyValue('--da-viewport-left')).toBe('4px');
    expect(style.getPropertyValue('--da-viewport-height')).toBe('210px');
    expect(style.getPropertyValue('--da-viewport-width')).toBe('380px');
    expect(document.documentElement.dataset.daTinyViewport).toBe('true');
    Object.assign(viewport, { height: 0, width: 0, offsetTop: 0 });
    viewport.dispatchEvent(new Event('resize')); flush();
    expect(style.getPropertyValue('--da-viewport-height')).toBe('210px');
    expect(style.getPropertyValue('--da-viewport-top')).toBe('48px');
    Object.assign(viewport, { height: 700, width: 390 });
    viewport.dispatchEvent(new Event('resize')); flush();
    expect(document.documentElement.dataset.daShortViewport).toBe('false');
  });

  it('keeps a focused field in its reading area without moving the window, refocusing or losing the caret', () => {
    const shell = document.createElement('section'); shell.className = 'da-arena-shell';
    const owner = document.createElement('div'); owner.style.overflowY = 'auto';
    const input = document.createElement('input'); input.value = 'My next pick';
    shell.append(owner); owner.append(input); document.body.append(shell);
    Object.defineProperties(owner, { clientHeight: { value: 120 }, scrollHeight: { value: 600 } });
    vi.spyOn(owner, 'getBoundingClientRect').mockReturnValue({ top: 100, bottom: 220, left: 0, right: 320, height: 120, width: 320 } as DOMRect);
    vi.spyOn(input, 'getBoundingClientRect').mockImplementation(() => ({ top: 230 - owner.scrollTop, bottom: 278 - owner.scrollTop, height: 48 } as DOMRect));
    const focus = vi.spyOn(input, 'focus');
    const moveWindow = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    release = bindDraftViewport();
    input.focus(); input.setSelectionRange(3, 3); flush();
    expect(owner.scrollTop).toBe(66);
    Object.assign(viewport, { height: 260, offsetTop: 70 });
    viewport.dispatchEvent(new Event('resize')); flush();
    expect(owner.scrollTop).toBe(66);
    Object.assign(viewport, { offsetTop: 110 });
    viewport.dispatchEvent(new Event('scroll')); flush();
    expect(owner.scrollTop).toBe(66);
    expect(moveWindow).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(input).toHaveFocus();
    expect(input.value).toBe('My next pick');
    expect(input.selectionStart).toBe(3);
  });

  it('cancels pending work and restores previous variables and priorities on leaving Arena', () => {
    const root = document.documentElement;
    root.style.setProperty('--da-viewport-top', '9px', 'important');
    root.setAttribute('data-da-short-viewport', 'previous');
    release = bindDraftViewport();
    viewport.dispatchEvent(new Event('resize'));
    expect(frames.size).toBe(1);
    release(); release = undefined;
    expect(frames.size).toBe(0);
    expect(root.style.getPropertyValue('--da-viewport-top')).toBe('9px');
    expect(root.style.getPropertyPriority('--da-viewport-top')).toBe('important');
    expect(root.style.getPropertyValue('--da-viewport-height')).toBe('');
    expect(root.getAttribute('data-da-short-viewport')).toBe('previous');
    expect(root.hasAttribute('data-da-tiny-viewport')).toBe(false);
    viewport.dispatchEvent(new Event('scroll'));
    expect(frames.size).toBe(0);
  });
});
