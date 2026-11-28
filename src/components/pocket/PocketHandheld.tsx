import { useRef, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Power } from "lucide-react";
import { useMesomonFullscreen } from "@/lib/mesomon/useMesomonFullscreen";
import { PocketDeviceContext } from "./deviceContext";
import "@/components/mesomon/mesomon.css";
import "./pocketHandheld.css";

export type PocketDirection = "up" | "right" | "down" | "left";
const arrows = { up: ChevronUp, right: ChevronRight, down: ChevronDown, left: ChevronLeft } as const;
const directions: PocketDirection[] = ["up", "right", "down", "left"];

/** The physical console stays mounted when the cartridge takes over the display. */
export function PocketDevice({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  const device = useRef<HTMLDivElement>(null);
  const fullscreen = useMesomonFullscreen(device);
  const beforePowerOff = useRef<(() => void) | null>(null);
  const closeDevice = onClose && (() => { beforePowerOff.current?.(); onClose(); });
  return createPortal(
    <div className={onClose ? "mm-device pocket-device" : "mm-device"} ref={device}>
      <PocketDeviceContext.Provider value={{ fullscreen, beforePowerOff, closeDevice }}>
        {onClose ? (
          <>
            <div className="pocket-bezel">
              <div className="pocket-nameplate" aria-label="DH Pocket">
                <span className="pocket-brand-stripes" aria-hidden="true"><i /><i /><i /></span>
                <b>DH POCKET</b>
              </div>
              <button type="button" className="pocket-power" onClick={closeDevice}
                aria-label="Close handheld and return to DH Club" title="Close handheld">
                <span className="pocket-power-light" aria-hidden="true" /><Power size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="pocket-device-stage">{children}</div>
          </>
        ) : children}
      </PocketDeviceContext.Provider>
    </div>,
    document.body,
  );
}

type Hold = {
  direction: PocketDirection | null;
  start: (direction: PocketDirection) => void;
  stop: () => void;
};

export function PocketDpad({ onDirection, hold, disabled = false, browseLabel = "Browse cartridges" }: {
  onDirection: (direction: PocketDirection) => void;
  /** Field movement can repeat while a finger is held and change direction as it slides. */
  hold?: Hold;
  browseLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="mm-dpad" role="group" aria-label={hold ? "Movement controls" : browseLabel}
      onPointerDown={hold && (event => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const direction = (event.target as Element).closest<HTMLButtonElement>("[data-mm-action]")?.dataset.mmAction as PocketDirection | undefined;
        if (direction && directions.includes(direction)) hold.start(direction);
      })}
      onPointerMove={hold && (event => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const dx = event.clientX - bounds.left - bounds.width / 2;
        const dy = event.clientY - bounds.top - bounds.height / 2;
        if (Math.abs(dx) + Math.abs(dy) < 12) hold.stop();
        else if (Math.abs(dx) > Math.abs(dy)) hold.start(dx > 0 ? "right" : "left");
        else hold.start(dy > 0 ? "down" : "up");
      })}
      onPointerUp={hold && (event => {
        hold.stop();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      })}
      onPointerCancel={hold?.stop} onLostPointerCapture={hold?.stop}>
      {directions.map(direction => {
        const Icon = arrows[direction];
        return (
          <button type="button" key={direction} className={`mm-direction mm-${direction}`}
            data-mm-action={direction} aria-label={`${hold ? "Move" : "Browse"} ${direction}`}
            aria-pressed={hold ? hold.direction === direction : undefined} disabled={disabled}
            onClick={event => { if (!hold || event.detail === 0) onDirection(direction); }}>
            <Icon size={22} aria-hidden="true" />
          </button>
        );
      })}
      <span aria-hidden="true" className="mm-dpad-center">◆</span>
    </div>
  );
}

export function PocketActionKeys({ onConfirm, onBack, confirmLabel, backLabel, confirmCaption, backCaption = "BACK", disabled = false }: {
  onConfirm: (event: MouseEvent<HTMLButtonElement>) => void;
  onBack: (event: MouseEvent<HTMLButtonElement>) => void;
  confirmLabel: string;
  backLabel: string;
  confirmCaption: string;
  backCaption?: string;
  disabled?: boolean;
}) {
  return (
    <div className="mm-ab">
      <button type="button" className="mm-b" data-mm-action="cancel" aria-label={`B — ${backLabel}`}
        onClick={onBack}>B</button>
      <button type="button" className="mm-a" data-mm-action="confirm" aria-label={`A — ${confirmLabel}`}
        onClick={onConfirm} disabled={disabled}>A</button>
      <span aria-hidden="true">{backCaption}</span><span aria-hidden="true">{confirmCaption}</span>
    </div>
  );
}

export function PocketMenuFrame({ children, onDirection, onConfirm, onBack, confirmLabel = "Launch cartridge", backLabel = "Close handheld", controlsDisabled = false }: {
  children: ReactNode;
  onDirection: (direction: PocketDirection) => void;
  onConfirm: () => void;
  onBack: () => void;
  confirmLabel?: string;
  backLabel?: string;
  controlsDisabled?: boolean;
}) {
  return (
    <div className="mesomon pocket-menu-frame">
      <main className="pocket-lcd">{children}</main>
      <div className="mm-control-deck">
        <PocketDpad onDirection={onDirection} disabled={controlsDisabled} />
        <PocketActionKeys onConfirm={onConfirm} onBack={onBack} confirmLabel={confirmLabel} backLabel={backLabel}
          confirmCaption="PLAY" disabled={controlsDisabled} />
      </div>
    </div>
  );
}
