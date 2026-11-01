export interface DeepClaimMarkProps { className?: string; label?: string; decorative?: boolean }

/** Original, self-contained shaft-and-seam emblem; never fetches external art. */
export function DeepClaimMark({ className = '', label = 'Deep Claim', decorative = false }: DeepClaimMarkProps) {
  return <svg viewBox="0 0 120 120" className={className} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : label} aria-hidden={decorative || undefined} focusable="false" shapeRendering="crispEdges">
    <path d="M28 6H92L114 28V92L92 114H28L6 92V28Z" fill="#262d27" stroke="#a48b5b" strokeWidth="3" />
    <path d="M29 12H90L108 30V91L90 108H29L12 91V30Z" fill="#384032" stroke="#59614a" strokeWidth="2" />
    <path d="M17 26H40V37H52V49H30V61H17ZM79 18H95V38H106V62H94V50H80ZM20 77H38V92H53V106H28L17 91Z" fill="#535642" />
    <path d="M35 37H85V45H78V99H42V45H35Z" fill="#141d1b" />
    <path d="M33 35H87V43H33ZM36 43H44V101H36ZM76 43H84V101H76Z" fill="#ac8c5d" />
    <path d="M44 65H76V71H44M44 88H76V94H44" fill="#766247" />
    <path d="M48 49H68L76 59L58 82L40 59Z" fill="#7b9f79" stroke="#bdd0a0" strokeWidth="2" />
    <path d="M48 49L52 60L58 82L63 60L68 49M40 59H76" fill="none" stroke="#d2d8ac" strokeWidth="2" />
    <path d="M22 17H42M17 22V34" stroke="#d1bd84" strokeWidth="2" opacity=".8" />
    <path d="M88 77H99V88H88Z" fill="#bc965a" /><path d="M91 80H96V83H91Z" fill="#e2c58c" />
  </svg>;
}
