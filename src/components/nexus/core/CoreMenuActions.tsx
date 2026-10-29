import type { ReactNode } from "react";
import { createPortal } from "react-dom";
export function CoreMenuActions({
  children,
  label = "Loadout actions",
  notice,
}: {
  children: ReactNode;
  label?: string;
  notice?: ReactNode;
}) {
  return createPortal(
    <div className="nx-mode nc-shell nc-menu-actionbar" aria-label={label}>
      {notice && <div className="nc-action-notice">{notice}</div>}
      <div className="nc-action-controls">{children}</div>
    </div>,
    document.body,
  );
}
