import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ARMORY } from "@/lib/nexus/core/progression";
import { CoreBayArtwork } from "./CoreSelectionDeck";

export function CoreUnlockReveal({
  item,
  onClose,
}: {
  item: (typeof ARMORY)[number] | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!item}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="nx-mode nc-shell nc-menu-dialog nc-unlock-reveal">
        <p className="nc-detail-role">
          <Check size={14} />
          SYSTEM ACQUIRED
        </p>
        <DialogTitle>{item?.name || "System acquired"}</DialogTitle>
        <DialogDescription>
          {item?.role || "Permanent equipment"}
        </DialogDescription>
        {item && (
          <>
            <div className="nc-unlock-art">
              <CoreBayArtwork id={item.id} />
              <i className="nc-unlock-ring" />
              <i className="nc-unlock-ring" />
            </div>
            <p className="nc-unlock-tag">PERMANENTLY UNLOCKED</p>
            <div className="nc-unlock-actions">
              <Link
                className="nc-button"
                to={`/nexus/loadout/endless?item=${item.id}`}
                onClick={onClose}
              >
                Equip now
                <ArrowRight size={17} />
              </Link>
              <button
                className="nc-button nc-button-secondary"
                onClick={onClose}
              >
                Continue
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
