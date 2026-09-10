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
        'relative overflow-hidden rounded-2xl pk-turf [--gold:45_95%_60%]',
        yardLines && 'pk-yardlines',
        shimmer && 'pk-stadium-shine',
        'border border-[hsl(45_95%_55%/0.30)]',
        'shadow-[0_8px_28px_hsl(160_60%_2%/0.6),inset_0_1px_0_hsl(0_0%_100%/0.06)]',
        className,
      )}
    >
      {/* top edge gold rule */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(45_95%_55%/0.85)] to-transparent" />
      {/* bottom shadow lip — like field boundary */}
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
      <div className="relative">{children}</div>
    </div>
  );
}
