import { createContext, type MutableRefObject } from "react";
import type { useMesomonFullscreen } from "@/lib/mesomon/useMesomonFullscreen";

interface PocketDeviceState {
  fullscreen: ReturnType<typeof useMesomonFullscreen>;
  beforePowerOff: MutableRefObject<(() => void) | null>;
}

export const PocketDeviceContext = createContext<PocketDeviceState | null>(null);
