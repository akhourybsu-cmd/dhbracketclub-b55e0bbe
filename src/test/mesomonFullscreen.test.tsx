import { useRef } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMesomonFullscreen } from '@/lib/mesomon/useMesomonFullscreen';

function Console() {
  const device = useRef<HTMLDivElement>(null);
  const { active, available, enterOnPlay, toggle, error } = useMesomonFullscreen(device);
  return (
    <div ref={device} data-testid="console">
      <button onClick={event => enterOnPlay(event.nativeEvent)}>Play</button>
      {available && <button onClick={toggle}>{active ? 'Exit full screen' : 'Full screen'}</button>}
      {error && <p role="status">{error}</p>}
    </div>
  );
}

function play(pointer: 'touch' | 'mouse' | 'keyboard' = 'touch') {
  const event = new MouseEvent('click', { bubbles: true, detail: pointer === 'keyboard' ? 0 : 1 });
  Object.defineProperty(event, 'pointerType', { value: pointer === 'keyboard' ? '' : pointer });
  fireEvent(screen.getByText('Play'), event);
}

const restorations: Array<() => void> = [];
function property(object: object, key: string, descriptor: PropertyDescriptor) {
  const original = Object.getOwnPropertyDescriptor(object, key);
  Object.defineProperty(object, key, { configurable: true, ...descriptor });
  restorations.push(() => {
    if (original) Object.defineProperty(object, key, original);
    else Reflect.deleteProperty(object, key);
  });
}

function browser({ coarse = true, installed = false, webkit = false, enabled = true } = {}) {
  let owner: Element | null = null;
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('pointer: coarse') ? coarse : installed && query.includes('display-mode: standalone'),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  const makeOwner = (next: Element | null) => {
    owner = next;
    fireEvent(document, new Event(webkit ? 'webkitfullscreenchange' : 'fullscreenchange'));
  };
  const request = vi.fn(function (this: Element, _options?: FullscreenOptions) {
    makeOwner(this);
    return webkit ? undefined : Promise.resolve();
  });
  const exit = vi.fn(() => {
    makeOwner(null);
    return webkit ? undefined : Promise.resolve();
  });
  property(document, webkit ? 'webkitFullscreenElement' : 'fullscreenElement', { get: () => owner });
  property(document, webkit ? 'webkitFullscreenEnabled' : 'fullscreenEnabled', { value: enabled });
  property(document, webkit ? 'webkitExitFullscreen' : 'exitFullscreen', { value: exit });
  property(HTMLElement.prototype, webkit ? 'webkitRequestFullscreen' : 'requestFullscreen', { value: request });
  return { request, exit, makeOwner };
}

afterEach(() => {
  cleanup();
  while (restorations.length) restorations.pop()!();
  vi.unstubAllGlobals();
});

describe('Mesomon native fullscreen', () => {
  it('uses the touch play gesture once and observes a browser-initiated exit', () => {
    const { request, makeOwner } = browser();
    render(<Console />);
    expect(request).not.toHaveBeenCalled();
    play();
    expect(request).toHaveBeenCalledWith({ navigationUI: 'hide' });
    expect(request.mock.instances[0]).toBe(screen.getByTestId('console'));
    expect(screen.getByText('Exit full screen')).toBeInTheDocument();
    makeOwner(null);
    play();
    expect(request).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Full screen'));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('keeps mouse and keyboard play windowed on a touch-capable desktop', () => {
    const { request } = browser({ coarse: true });
    render(<Console />);
    play('mouse');
    play('keyboard');
    expect(request).not.toHaveBeenCalled();
    play('touch');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('recognizes WebKit taps when the resulting click has no pointer type', () => {
    const { request } = browser({ webkit: true });
    render(<Console />);
    const button = screen.getByText('Play');
    const pointer = new Event('pointerup', { bubbles: true });
    Object.defineProperty(pointer, 'pointerType', { value: 'touch' });
    fireEvent(button, pointer);
    fireEvent.click(button, { detail: 1 });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('respects a manual exit and uses the older WebKit fullscreen events', () => {
    const { request, exit } = browser({ webkit: true });
    render(<Console />);
    fireEvent.click(screen.getByText('Full screen'));
    fireEvent.click(screen.getByText('Exit full screen'));
    play();
    expect(exit).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('enters only on explicit request with a fine pointer', () => {
    const { request } = browser({ coarse: false });
    render(<Console />);
    play();
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Full screen'));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([{ installed: true }, { enabled: false }])('keeps the edge-to-edge shell when native fullscreen is redundant or disabled: %s', options => {
    const { request } = browser(options);
    render(<Console />);
    expect(screen.queryByText('Full screen')).toBeNull();
    play();
    expect(request).not.toHaveBeenCalled();
  });

  it('leaves unrelated fullscreen owners alone during play and unmount', () => {
    const { request, exit, makeOwner } = browser();
    render(<Console />);
    makeOwner(document.documentElement);
    expect(screen.queryByText('Full screen')).toBeNull();
    play();
    cleanup();
    expect(request).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('continues after a denied play request and reports a denied explicit retry', async () => {
    const { request } = browser();
    request.mockImplementation(() => Promise.reject(new Error('User denied fullscreen')));
    render(<Console />);
    play();
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    play();
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByText('Full screen'));
    expect(await screen.findByRole('status')).toHaveTextContent('You can keep playing.');
    expect(request).toHaveBeenCalledTimes(2);
  });
});
