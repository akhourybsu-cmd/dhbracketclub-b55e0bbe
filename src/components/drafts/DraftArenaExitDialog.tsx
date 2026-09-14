import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * "Leave the Draft Arena?" confirmation. Mirrors the Pick'em / Nexus exit
 * pattern so stepping out of the standalone Draft shell is deliberate.
 */
export function DraftArenaExitDialog({
  open, onOpenChange, onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="da-exit-dialog border-gold/30">
        <AlertDialogHeader>
          <AlertDialogTitle className="da-exit-title text-lg font-black tracking-tight">
            Leave the Draft Arena?
          </AlertDialogTitle>
          <AlertDialogDescription className="da-exit-description text-sm">
            You'll head back to the league hub. Drafts in progress keep running — come back anytime to make your pick.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="da-exit-cancel">
            Stay in the Arena
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="da-exit-action font-extrabold"
          >
            Exit
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
