import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'default' | 'primary' | 'danger';
};

/** Shared 44px touch target for compact shell and page actions. */
export const MobileIconButton = forwardRef<HTMLButtonElement, Props>(
  ({ className, tone = 'default', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-transparent',
        'touch-manipulation transition-[transform,background-color,color,border-color,opacity] duration-100',
        'active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-45',
        tone === 'default' && 'text-foreground/80 hover:bg-muted/50 active:bg-muted/70',
        tone === 'primary' && 'bg-primary/12 text-primary hover:bg-primary/18 active:bg-primary/24',
        tone === 'danger' && 'bg-destructive/10 text-destructive hover:bg-destructive/16 active:bg-destructive/22',
        className,
      )}
      {...props}
    />
  ),
);

MobileIconButton.displayName = 'MobileIconButton';
