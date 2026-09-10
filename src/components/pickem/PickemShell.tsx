import { cn } from '@/lib/utils';

/**
 * Backwards-compat pass-through.
 *
 * Originally this component injected the `.pk-stadium` skin and negative
 * margins on each Pick'em page. That responsibility has moved up to
 * `PickemLayout`, which wraps every NFL Game Center route as a true standalone
 * shell (matching Nexus / Rune Delve). Pages that still wrap their content
 * in `<PickemShell>` continue to work — this component now just renders a
 * passthrough container so the existing JSX structure isn't disturbed.
 */
export function PickemShell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn('contents', className)}>{children}</div>;
}
