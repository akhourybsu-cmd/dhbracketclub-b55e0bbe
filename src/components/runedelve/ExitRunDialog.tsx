import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import "./runeDialogs.css";
import { useRuneDialogFocus } from "./useRuneDialogFocus";
import { useSheetSfx } from "@/hooks/useSheetSfx";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  canResume?: boolean;
}

/** Confirmation when leaving Rune Delve mid-run. */
export function ExitRunDialog({
  open,
  onOpenChange,
  onConfirm,
  canResume = true,
}: Props) {
  useSheetSfx(open);
  const focus = useRuneDialogFocus();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        {...focus}
        className="rd-dialog-theme rd-compact-exit"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {canResume ? "Return to the sanctum?" : "Leave the arena?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {canResume
              ? "Your current run is saved on this device. Return when you’re ready."
              : "This timed run will end when you leave. Stay to finish your attempt."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11">Stay</AlertDialogCancel>
          <AlertDialogAction className="min-h-11" onClick={onConfirm}>
            Return
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
