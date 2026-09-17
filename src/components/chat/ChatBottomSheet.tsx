import type { ReactNode } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface ChatBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function ChatBottomSheet({ open, onOpenChange, title, description, children, className }: ChatBottomSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          'z-[80] max-h-[82dvh] overflow-y-auto rounded-t-2xl border-border/40 bg-background/98 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-2 shadow-2xl sm:hidden',
          'data-[state=open]:duration-200 data-[state=closed]:duration-150 motion-reduce:duration-0',
          className,
        )}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted-foreground/25" aria-hidden="true" />
        <SheetHeader className="px-1 pb-2 text-left">
          <SheetTitle className="text-base">{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : <SheetDescription className="sr-only">{title}</SheetDescription>}
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}