import { useState, useRef } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { BookOpen, Trash2 } from "lucide-react";
import "./deleteFileDialog.css";

interface Props {
  slot: number;
  location: string;
  minutes: number;
  cloud: boolean;
  onDelete: () => Promise<void>;
  onDeleted: () => void;
  restoreFocus: () => void;
}

export function DeleteFileDialog({ slot, location, minutes, cloud, onDelete, onDeleted, restoreFocus }: Props) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  async function confirm() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await onDelete();
      onDeleted();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The file could not be deleted. Try again.");
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <AlertDialog.Overlay className="mm-file-shade" />
      <AlertDialog.Content
        className="mm-file-dialog"
        onEscapeKeyDown={event => { if (submitting.current) event.preventDefault(); }}
        onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(); }}
        aria-busy={busy}
      >
        <span className="mm-file-book" aria-hidden="true"><BookOpen size={24} /></span>
        <AlertDialog.Title>Delete File {slot}?</AlertDialog.Title>
        <p className="mm-file-place">{location} · {minutes} min</p>
        <AlertDialog.Description>
          {cloud
            ? "This permanently removes this journey from your device and your cloud saves."
            : "This permanently removes this journey from this device."}
        </AlertDialog.Description>
        {error && <p role="alert" className="mm-file-error">{error}</p>}
        <div className="mm-file-choices">
          <AlertDialog.Cancel asChild><button type="button" disabled={busy}>Keep file</button></AlertDialog.Cancel>
          <button type="button" disabled={busy} onClick={() => void confirm()}>
            <Trash2 size={15} aria-hidden="true" /> {busy ? "Deleting…" : "Delete file"}
          </button>
        </div>
      </AlertDialog.Content>
    </>
  );
}
