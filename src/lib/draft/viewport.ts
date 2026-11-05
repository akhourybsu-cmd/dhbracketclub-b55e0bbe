export interface DraftViewportBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

type VisualBounds = Partial<Pick<VisualViewport, 'height' | 'width' | 'offsetTop' | 'offsetLeft'>>;

/** Safari can pan its visual viewport independently of the layout viewport. */
export function measureDraftViewport(
  visual: VisualBounds | null | undefined,
  fallback: { width: number; height: number },
  previous?: DraftViewportBounds,
): DraftViewportBounds {
  const height = visual?.height ?? fallback.height;
  const width = visual?.width ?? fallback.width;
  if (!Number.isFinite(height) || height < 120 || !Number.isFinite(width) || width <= 0) {
    return previous ?? { ...fallback, top: 0, left: 0 };
  }
  return {
    top: visual && Number.isFinite(visual.offsetTop) ? Math.max(0, visual.offsetTop!) : 0,
    left: visual && Number.isFinite(visual.offsetLeft) ? Math.max(0, visual.offsetLeft!) : 0,
    width,
    height,
  };
}

const PROPERTIES = ['--da-viewport-top', '--da-viewport-left', '--da-viewport-width', '--da-viewport-height',
  '--da-viewport-bottom-gap', '--da-viewport-right-gap'] as const;
const ATTRIBUTES = ['data-da-short-viewport', 'data-da-tiny-viewport'] as const;

function keepFocusedFieldVisible(bounds: DraftViewportBounds) {
  const field = document.activeElement;
  if (!(field instanceof HTMLElement) || !field.matches('input, textarea, select, [contenteditable="true"]')
    || !field.closest('.da-arena-shell, .da-arena-dialog, .da-pk') || field.closest('[hidden],[inert]')) return;
  const fieldBox = field.getBoundingClientRect();
  if (!fieldBox.height) return;
  for (let owner = field.parentElement; owner && owner !== document.body; owner = owner.parentElement) {
    if (!/^(auto|scroll)$/.test(getComputedStyle(owner).overflowY) || owner.scrollHeight <= owner.clientHeight + 1) continue;
    const box = owner.getBoundingClientRect();
    const top = Math.max(bounds.top, box.top + owner.clientTop);
    const bottom = Math.min(bounds.top + bounds.height, box.top + owner.clientTop + owner.clientHeight);
    const gap = bottom - top >= fieldBox.height + 16 ? 8 : 0;
    // Resize only the actual reading area. Scrolling the window or repeatedly
    // refocusing an input makes iOS pan again and can interrupt composition.
    const delta = fieldBox.top < top + gap || fieldBox.height > bottom - top
      ? fieldBox.top - top - gap
      : fieldBox.bottom > bottom - gap ? fieldBox.bottom - bottom + gap : 0;
    if (delta) owner.scrollTop += delta;
    return;
  }
}

/** One Arena-owned viewport binding, shared by its shell and body portals. */
export function bindDraftViewport() {
  const root = document.documentElement;
  const style = root.style;
  const viewport = window.visualViewport;
  const properties = PROPERTIES.map(name => ({ name, value: style.getPropertyValue(name), priority: style.getPropertyPriority(name) }));
  const attributes = ATTRIBUTES.map(name => ({ name, value: root.getAttribute(name) }));
  let frame = 0;
  let focusFrame = 0;
  let ensureFocused = false;
  let bounds: DraftViewportBounds | undefined;
  const update = () => {
    bounds = measureDraftViewport(viewport, { width: window.innerWidth, height: window.innerHeight }, bounds);
    const values = [bounds.top, bounds.left, bounds.width, bounds.height,
      Math.max(0, window.innerHeight - bounds.top - bounds.height),
      Math.max(0, window.innerWidth - bounds.left - bounds.width)];
    for (const [index, value] of values.entries()) {
      style.setProperty(PROPERTIES[index], `${value}px`);
    }
    root.dataset.daShortViewport = String(bounds.height < 340);
    root.dataset.daTinyViewport = String(bounds.height < 260);
    if (ensureFocused) {
      cancelAnimationFrame(focusFrame);
      // Let viewport-dependent flex sizing and browser scroll anchoring settle
      // before measuring the field's actual reading area.
      focusFrame = requestAnimationFrame(() => {
        focusFrame = 0;
        if (bounds) keepFocusedFieldVisible(bounds);
      });
    }
    ensureFocused = false;
    frame = 0;
  };
  const schedule = (keepFocused: boolean) => {
    ensureFocused ||= keepFocused;
    if (!frame) frame = requestAnimationFrame(update);
  };
  const resize = () => schedule(true);
  const pan = () => schedule(false);
  const focus = () => schedule(true);
  update();
  viewport?.addEventListener('resize', resize);
  viewport?.addEventListener('scroll', pan);
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  document.addEventListener('focusin', focus);
  return () => {
    cancelAnimationFrame(frame);
    cancelAnimationFrame(focusFrame);
    viewport?.removeEventListener('resize', resize);
    viewport?.removeEventListener('scroll', pan);
    window.removeEventListener('resize', resize);
    window.removeEventListener('orientationchange', resize);
    document.removeEventListener('focusin', focus);
    for (const { name, value, priority } of properties) {
      if (value) style.setProperty(name, value, priority);
      else style.removeProperty(name);
    }
    for (const { name, value } of attributes) {
      if (value === null) root.removeAttribute(name);
      else root.setAttribute(name, value);
    }
  };
}
