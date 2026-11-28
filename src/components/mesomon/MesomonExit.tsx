import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/** Cartridge ejection keeps the console open. The standalone route returns to Compete. */
export function MesomonExit({ children, onLeave, onExitPocketGame, className, iconOnly, command }: {
  children?: ReactNode;
  onLeave?: () => void;
  onExitPocketGame?: () => void;
  className?: string;
  iconOnly?: boolean;
  command?: string;
}) {
  const label = iconOnly ? "Exit game" : undefined;
  const props = { className, "data-command": command, "aria-label": label, title: label };
  return onExitPocketGame ? (
    <button type="button" {...props} onClick={() => { onLeave?.(); onExitPocketGame(); }}>
      {children ?? "Exit game"}
    </button>
  ) : (
    <Link {...props} to="/compete" onClick={onLeave}>{children ?? "Exit game"}</Link>
  );
}
