/** Reset the visible owner on view changes without moving horizontal boards.
 * Mobile scrolls main; desktop keeps the bounded room pane. */
export function resetDraftViewScroll(panel: HTMLElement | null) {
  if (!panel) return;
  panel.scrollTop = 0;
  const main = panel.closest<HTMLElement>('.da-arena-main');
  if (main && /^(auto|scroll)$/.test(getComputedStyle(main).overflowY)) main.scrollTop = 0;
}
