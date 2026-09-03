import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MobileIconButton } from './MobileIconButton';

type Props = {
  title: string;
  eyebrow?: string;
  description?: string;
  backTo?: string;
  action?: ReactNode;
  className?: string;
};

/** Consistent in-page heading for non-game mobile surfaces. */
export function ScreenHeader({ title, eyebrow, description, backTo, action, className }: Props) {
  const navigate = useNavigate();
  return (
    <header className={cn('mb-5 flex items-start gap-3', className)}>
      {backTo && (
        <MobileIconButton
          aria-label="Go back"
          className="-ml-2 mt-0.5 flex-shrink-0"
          onClick={() => backTo === '-1' ? navigate(-1) : navigate(backTo)}
        >
          <ChevronLeft className="h-5 w-5" />
        </MobileIconButton>
      )}
      <div className="min-w-0 flex-1 pt-0.5">
        {eyebrow && <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>}
        <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.025em] text-foreground">{title}</h1>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </header>
  );
}
