import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function AppSurface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/45 bg-card text-card-foreground',
        'shadow-[var(--shadow-card)]',
        className,
      )}
      {...props}
    />
  );
}
