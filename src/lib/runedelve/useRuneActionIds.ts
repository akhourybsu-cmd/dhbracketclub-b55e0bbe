import { useRef } from "react";

/** Keep the same receipt ID when a write times out and is retried. A new
 * acknowledged action gets a new ID, even when its inputs are identical. */
export function useRuneActionIds() {
  const pending = useRef(new Map<string, string>());
  return {
    get(key: string): string {
      let id = pending.current.get(key);
      if (!id) {
        try {
          id = sessionStorage.getItem(`rd-action-v1:${key}`) ?? undefined;
        } catch {
          /* private browsing */
        }
        if (!id) id = crypto.randomUUID();
        pending.current.set(key, id);
        try {
          sessionStorage.setItem(`rd-action-v1:${key}`, id);
        } catch {
          /* private browsing */
        }
      }
      return id;
    },
    complete(key: string) {
      pending.current.delete(key);
      try {
        sessionStorage.removeItem(`rd-action-v1:${key}`);
      } catch {
        /* private browsing */
      }
    },
  };
}
