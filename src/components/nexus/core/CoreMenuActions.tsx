import type { ReactNode } from "react";
import { createPortal } from "react-dom";
export function CoreMenuActions({
  children,
  label = "Loadout actions",
}: {
  children: ReactNode;
  label?: string;
}) {
  return createPortal(
    <div className="nx-mode nc-shell nc-menu-actionbar" aria-label={label}>
      {children}
    </div>,
    document.body,
  );
}
