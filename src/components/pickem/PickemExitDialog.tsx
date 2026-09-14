import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * "Exit NFL Game Center?" confirmation. Shown when the user taps the back arrow
 * on the NFL hub. Mirrors the Nexus/RuneDelve exit pattern so leaving
 * the standalone module always feels deliberate.
 */
export function PickemExitDialog({
  open, onOpenChange, onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="nfl-command-dialog"
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="nfl-dialog-title text-lg font-black tracking-tight">
            Exit NFL Game Center?
          </AlertDialogTitle>
          <AlertDialogDescription className="nfl-dialog-description text-sm">
            You'll head back to DH Club. Your picks and Crazy Chain are safe — come back anytime.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="nfl-dialog-cancel">
            Stay in Game Center
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="nfl-dialog-action font-extrabold"
          >
            Exit
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
