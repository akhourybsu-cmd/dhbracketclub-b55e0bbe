import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';

interface NavDrawerCtx {
  open: boolean;
  setOpen: (o: boolean, opener?: HTMLElement | null) => void;
  toggle: () => void;
  restoreFocus: (restore?: boolean) => void;
}

const Ctx = createContext<NavDrawerCtx>({ open: false, setOpen: () => {}, toggle: () => {}, restoreFocus: () => {} });

export function NavDrawerProvider({ children }: { children: ReactNode }) {
  const [open, updateOpen] = useState(false);
  const openRef = useRef(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const setOpen = useCallback((next: boolean, opener?: HTMLElement | null) => {
    if (next && !openRef.current) {
      const target = opener ?? document.activeElement;
      openerRef.current = target instanceof HTMLElement ? target : null;
    }
    openRef.current = next;
    updateOpen(next);
  }, []);
  const restoreFocus = useCallback((restore = true) => {
    const target = openerRef.current;
    openerRef.current = null;
    if (restore && target?.isConnected) target.focus({ preventScroll: true });
  }, []);
  return (
    <Ctx.Provider value={{ open, setOpen, toggle: () => setOpen(!openRef.current), restoreFocus }}>
      {children}
    </Ctx.Provider>
  );
}

export const useNavDrawer = () => useContext(Ctx);
