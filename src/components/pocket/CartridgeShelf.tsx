import { useLayoutEffect, useRef } from 'react';
import type { PocketCartridge } from './cartridges';

export function CartridgeFace({ cartridge }: { cartridge: PocketCartridge }) {
  return (
    <span className="dp-cart-body" aria-hidden="true">
      <span className="dp-cart-ridges" />
      <span className="dp-cart-sticker">
        <img src={cartridge.labelArtwork} alt="" draggable={false} />
        <span className="dp-cart-print">
          <strong>{cartridge.title}</strong>
          <small>{cartridge.edition}</small>
        </span>
      </span>
      <span className="dp-cart-base"><i /><b /><i /></span>
    </span>
  );
}

export function CartridgeShelf({ cartridges, selected, onSelect, onLaunch }: {
  cartridges: readonly PocketCartridge[];
  selected: PocketCartridge;
  onSelect: (cartridge: PocketCartridge) => void;
  onLaunch: (cartridge: PocketCartridge) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const pointerSelecting = useRef(false);
  const index = cartridges.findIndex(cartridge => cartridge.id === selected.id);
  const multi = cartridges.length > 1;

  // Snap the previously selected cartridge into view on return, rotation or D-pad input.
  useLayoutEffect(() => {
    const shelf = rail.current;
    if (!shelf) return;
    function center() {
      const card = shelf?.children[index] as HTMLElement | undefined;
      if (shelf && card) shelf.scrollLeft = card.offsetLeft + card.offsetWidth / 2 - shelf.clientWidth / 2;
    }
    center();
    (shelf.children[index] as HTMLButtonElement | undefined)?.focus({ preventScroll: true });
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(center);
    observer.observe(shelf);
    return () => observer.disconnect();
  }, [index]);

  function browseScroll() {
    const shelf = rail.current;
    if (!multi || !shelf) return;
    const middle = shelf.scrollLeft + shelf.clientWidth / 2;
    const centered = Array.from(shelf.children).findIndex(child => {
      const card = child as HTMLElement;
      return Math.abs(card.offsetLeft + card.offsetWidth / 2 - middle) <= 2;
    });
    if (centered !== -1 && centered !== index) onSelect(cartridges[centered]);
  }

  return (
    <section className="dp-display dp-library" data-pocket-screen="selector" aria-labelledby="dp-library-title">
      <header className="dp-library-head">
        <h1 id="dp-library-title">Select a Game</h1>
        <span className="dp-position" aria-label={`Cartridge ${index + 1} of ${cartridges.length}`}>
          {String(index + 1).padStart(2, '0')} <i>/</i> {String(cartridges.length).padStart(2, '0')}
        </span>
      </header>
      <div className="dp-rack">
        <div className="dp-rail" ref={rail} onScroll={browseScroll} aria-label="Game cartridges">
          {cartridges.map(cartridge => (
            <button type="button" key={cartridge.id} className="dp-cart"
              aria-label={`Play ${cartridge.title}`}
              aria-current={selected.id === cartridge.id || undefined}
              onPointerDown={() => { pointerSelecting.current = true; }}
              onPointerUp={() => { pointerSelecting.current = false; }}
              onPointerCancel={() => { pointerSelecting.current = false; }}
              onFocus={() => { if (!pointerSelecting.current) onSelect(cartridge); }}
              onClick={() => onLaunch(cartridge)}>
              <CartridgeFace cartridge={cartridge} />
            </button>
          ))}
        </div>
      </div>
      <footer className="dp-library-foot">
        {multi && <span><b aria-hidden="true">◂ ▸</b> Browse</span>}
        <span><kbd>A</kbd> Play cartridge</span>
      </footer>
      <span className="sr-only" aria-live="polite">{selected.title}, {index + 1} of {cartridges.length}</span>
    </section>
  );
}
