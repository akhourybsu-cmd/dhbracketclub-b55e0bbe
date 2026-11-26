import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

type GameDevice = HTMLDivElement & { webkitRequestFullscreen?: () => void | Promise<void> };
type GameDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void | Promise<void>;
};

function fullscreenElement(doc: GameDocument) {
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function standalone() {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches;
}

function supported(node: GameDevice, doc: GameDocument) {
  if (typeof node.requestFullscreen === 'function') {
    return doc.fullscreenEnabled !== false && typeof doc.exitFullscreen === 'function';
  }
  return doc.webkitFullscreenEnabled !== false && typeof node.webkitRequestFullscreen === 'function' &&
    typeof doc.webkitExitFullscreen === 'function';
}

const failureMessage = 'Full screen is unavailable here. You can keep playing.';

/** The stable game host owns fullscreen. Removing it also ends native fullscreen. */
export function useMesomonFullscreen(device: RefObject<HTMLDivElement>) {
  const [available, setAvailable] = useState(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoAttempted = useRef(false);
  const lastTouchButton = useRef<HTMLButtonElement | null>(null);
  const pending = useRef<{ explicit: boolean } | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout>>();

  const finish = useCallback(() => {
    clearTimeout(timeout.current);
    pending.current = null;
  }, []);

  const sync = useCallback(() => {
    const node = device.current;
    if (!node) return;
    const doc = node.ownerDocument;
    const owner = fullscreenElement(doc);
    const ours = owner === node;
    setActive(ours);
    setAvailable(ours || (!owner && !standalone() && supported(node, doc)));
  }, [device]);

  useEffect(() => {
    const node = device.current;
    if (!node) return;
    const doc = node.ownerDocument;
    const changed = () => {
      finish();
      setError(null);
      sync();
    };
    const failed = (event: Event) => {
      if (event.target !== node && event.target !== doc) return;
      if (pending.current?.explicit) setError(failureMessage);
      finish();
      sync();
    };
    // Some WebKit versions synthesize a plain MouseEvent for a tap. Match
    // that click to the actual pointer release on the same button.
    const rememberPointer = (event: PointerEvent) => {
      lastTouchButton.current = event.pointerType === 'touch' && event.target instanceof Element
        ? event.target.closest('button') : null;
    };
    sync();
    node.addEventListener('pointerup', rememberPointer, true);
    doc.addEventListener('fullscreenchange', changed);
    doc.addEventListener('webkitfullscreenchange', changed);
    doc.addEventListener('fullscreenerror', failed);
    doc.addEventListener('webkitfullscreenerror', failed);
    const mode = window.matchMedia?.('(display-mode: standalone), (display-mode: fullscreen)');
    mode?.addEventListener?.('change', sync);
    return () => {
      finish();
      node.removeEventListener('pointerup', rememberPointer, true);
      doc.removeEventListener('fullscreenchange', changed);
      doc.removeEventListener('webkitfullscreenchange', changed);
      doc.removeEventListener('fullscreenerror', failed);
      doc.removeEventListener('webkitfullscreenerror', failed);
      mode?.removeEventListener?.('change', sync);
    };
  }, [device, finish, sync]);

  const change = useCallback((explicit: boolean) => {
    const node: GameDevice | null = device.current;
    if (!node || pending.current) return;
    const doc: GameDocument = node.ownerDocument;
    const owner = fullscreenElement(doc);
    if ((owner && owner !== node) || !supported(node, doc)) return;
    if (!owner && standalone()) return;
    if (!explicit && (autoAttempted.current || owner || !window.matchMedia?.('(pointer: coarse)').matches)) return;

    // Keep this call synchronous with the player's gesture. Never reclaim the
    // screen after Escape, a declined request, or an intentional manual exit.
    autoAttempted.current = true;
    setError(null);
    const attempt = { explicit };
    pending.current = attempt;
    const complete = (failed: boolean) => {
      if (pending.current !== attempt) return;
      finish();
      if (device.current !== node) return;
      if (failed && explicit) setError(failureMessage);
      sync();
    };
    try {
      const standard = typeof node.requestFullscreen === 'function';
      const request = owner === node
        ? (standard ? doc.exitFullscreen() : doc.webkitExitFullscreen!())
        : (standard ? node.requestFullscreen({ navigationUI: 'hide' }) : node.webkitRequestFullscreen!());
      if (request) {
        void request.then(() => complete(false), () => complete(true));
      } else if (pending.current === attempt) {
        // Older WebKit signals completion only through events. Release a
        // silently refused request so the player can try the button again.
        timeout.current = setTimeout(() => complete(fullscreenElement(doc) !== (owner ? null : node)), 1500);
      }
    } catch {
      complete(true);
    }
  }, [device, finish, sync]);

  const enterOnPlay = (event: MouseEvent) => {
    const pointer = (event as Partial<PointerEvent>).pointerType;
    const fromTouch = pointer ? pointer === 'touch' :
      event.detail > 0 && event.target instanceof Node && lastTouchButton.current?.contains(event.target);
    lastTouchButton.current = null;
    if (fromTouch) change(false);
  };
  return { available, active, error, toggle: () => change(true), enterOnPlay };
}
