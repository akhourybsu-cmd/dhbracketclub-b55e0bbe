import { cn } from '@/lib/utils';

/**
 * Stadium turf backdrop with yard-line texture and stadium light shimmer.
 * Use as the wrapper for hero sections / scorebug headers.
 *
 * Pure presentation — no business logic, no data dependencies.
 */
export function TurfBackdrop({
  className,
  children,
  shimmer = true,
  yardLines = true,
}: {
  className?: string;
  children: React.ReactNode;
  shimmer?: boolean;
  yardLines?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden pk-turf',
        yardLines && 'pk-yardlines',
        shimmer && 'pk-stadium-shine',
        className,
      )}
    >
      {/* top edge gold rule */}
      <div className="nfl-surface-rule" />
      {/* bottom shadow lip — like field boundary */}
      <div className="nfl-surface-lip" />
      <div className="relative">{children}</div>
    </div>
  );
}
