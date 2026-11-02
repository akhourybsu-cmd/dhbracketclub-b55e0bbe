export interface TutorialRect { left: number; top: number; width: number; height: number }
export interface TutorialPanelPlacement extends TutorialRect { compact: boolean; targetVisible: boolean; noRoom: boolean }
export function tutorialIntersection(a: TutorialRect, b: TutorialRect): TutorialRect | null {
  const left = Math.max(a.left, b.left), top = Math.max(a.top, b.top), right = Math.min(a.left + a.width, b.left + b.width), bottom = Math.min(a.top + a.height, b.top + b.height);
  return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : null;
}
export function placeTutorialPanel(bounds: TutorialRect, target: TutorialRect | null, preferredHeight = 220): TutorialPanelPlacement {
  const gap = 9, width = Math.min(370, bounds.width), visible = target ? tutorialIntersection(target, bounds) : null;
  if (!visible) return { left: bounds.left + Math.max(0, (bounds.width - width) / 2), top: bounds.top + Math.max(0, bounds.height - Math.min(preferredHeight, bounds.height)), width, height: Math.min(preferredHeight, bounds.height), compact: bounds.height < 160, targetVisible: false, noRoom: false };
  const free: TutorialRect[] = [
    { left: bounds.left, top: bounds.top, width: bounds.width, height: Math.max(0, visible.top - bounds.top - gap) },
    { left: bounds.left, top: visible.top + visible.height + gap, width: bounds.width, height: Math.max(0, bounds.top + bounds.height - visible.top - visible.height - gap) },
    { left: bounds.left, top: bounds.top, width: Math.max(0, visible.left - bounds.left - gap), height: bounds.height },
    { left: visible.left + visible.width + gap, top: bounds.top, width: Math.max(0, bounds.left + bounds.width - visible.left - visible.width - gap), height: bounds.height },
  ];
  const full = free.filter(area => area.width >= Math.min(280, width) && area.height >= 145).sort((a, b) => Math.min(b.width, 370) * Math.min(b.height, preferredHeight) - Math.min(a.width, 370) * Math.min(a.height, preferredHeight));
  const compact = free.filter(area => area.width >= 280 && area.height >= 62).sort((a, b) => b.width * b.height - a.width * a.height);
  const space = full[0] ?? compact[0];
  if (!space) return { left: bounds.left, top: bounds.top + Math.max(0, bounds.height - Math.min(220, bounds.height)), width: bounds.width, height: Math.min(220, bounds.height), compact: bounds.height < 145, targetVisible: true, noRoom: true };
  const panelWidth = Math.min(width, space.width), height = full.length ? Math.min(preferredHeight, space.height) : 62;
  return { left: space.left + (space.width - panelWidth) / 2, top: space.top + (space.height - height) / 2, width: panelWidth, height, compact: !full.length, targetVisible: true, noRoom: false };
}
