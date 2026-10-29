import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { CoreEquipmentArt } from "./CoreArtwork";
export interface CoreDetailItem {
  id: string;
  name: string;
  role: string;
  description: string;
  tradeoff?: string;
}
export function CoreDetails({
  item,
  onClose,
  children,
}: {
  item: CoreDetailItem | null;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog
      open={!!item}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="nx-mode nc-shell nc-menu-dialog">
        {item && (
          <>
            <p className="nc-detail-role">{item.role}</p>
            <DialogTitle>{item.name}</DialogTitle>
            <div className="nc-detail-content">
              <CoreEquipmentArt id={item.id} />
              <DialogDescription>{item.description}</DialogDescription>
              {item.tradeoff && (
                <div className="nc-detail-tradeoff">{item.tradeoff}</div>
              )}
              {children}
            </div>
            <button className="nc-button" onClick={onClose}>
              Done
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
