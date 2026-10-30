let activePlayer: string | null = null;
const listeners = new Set<() => void>();

export const getDropPlayback = () => activePlayer;
export function subscribeDropPlayback(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function requestDropPlayback(id: string) {
  if (activePlayer === id) return;
  activePlayer = id;
  listeners.forEach((listener) => listener());
}
export function stopDropPlayback(id: string) {
  if (activePlayer === id) pauseDropPlayback();
}
/** Stop media before opening a composer, comments, sharing or another route. */
export function pauseDropPlayback() {
  if (activePlayer === null) return;
  activePlayer = null;
  listeners.forEach((listener) => listener());
}
