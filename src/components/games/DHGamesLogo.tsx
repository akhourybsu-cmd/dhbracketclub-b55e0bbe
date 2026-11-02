import { useId } from 'react';

export interface DHGamesLogoProps {
  className?: string;
  label?: string;
  decorative?: boolean;
}

/**
 * Original DH publisher artwork: an interlocked, bevel-cut monogram and
 * individually drawn wordmark. All lettering is geometry, with no font or
 * external image dependency. The surrounding splash owns motion and timing.
 */
export function DHGamesLogo({ className = '', label = 'DH Games', decorative = false }: DHGamesLogoProps) {
  const id = useId().replace(/:/g, '');
  return <svg viewBox="0 0 480 378" className={className} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : label} aria-hidden={decorative || undefined} focusable="false" data-dh-games-logo="true" shapeRendering="geometricPrecision">
    <defs>
      <linearGradient id={`${id}-ivory`} x1="143" y1="43" x2="331" y2="245" gradientUnits="userSpaceOnUse"><stop stopColor="#fff9e8" /><stop offset=".52" stopColor="#eee8d9" /><stop offset="1" stopColor="#c7ccbf" /></linearGradient>
      <linearGradient id={`${id}-brass`} x1="237" y1="131" x2="323" y2="158" gradientUnits="userSpaceOnUse"><stop stopColor="#e9d0a0" /><stop offset=".5" stopColor="#c8a66d" /><stop offset="1" stopColor="#ad8955" /></linearGradient>
    </defs>
    <g transform="translate(19 0)">
      {/* D and H share a structural upright; the dark joint keeps both legible. */}
      <path d="M104 54H198L246 102V198L198 246H104V54ZM138 88V212H184L212 184V116L184 88H138Z" fill="#091211" fillRule="evenodd" />
      <path d="M228 54H262V133H304V54H338V246H304V167H262V246H228V54Z" fill="#091211" />
      <path d="M104 48H198L246 96V192L198 240H104V48ZM138 82V206H184L212 178V110L184 82H138Z" fill={`url(#${id}-ivory)`} fillRule="evenodd" />
      <path d="M228 48H262V127H304V48H338V240H304V161H262V240H228V48Z" fill={`url(#${id}-ivory)`} />
      <path d="M228 91V124L246 142V109Z" fill="#17221f" />
      <path d="M228 161H262V185L228 219V194L237 185V170H228Z" fill="#17221f" />
      <path d="M256 133H304V155H256L245 144Z" fill={`url(#${id}-brass)`} />
      <path d="M104 48H198L219 69" fill="none" stroke="#fffbea" strokeWidth="2" opacity=".7" />
      <path d="M306 50H336V84" fill="none" stroke="#fffbea" strokeWidth="2" opacity=".55" />
      <path d="M270 140H277V147H270Z" fill="#25302a" />
      <path d="M284 140H291V147H284Z" fill="#25302a" />
    </g>
    {/* Seven custom glyphs; the generous gap separates DH from GAMES. */}
    <g transform="translate(12 0)" fill="#f1ecde">
      <path d="M43 296H67L81 310V326L67 340H43V296ZM52 305V331H63L72 322V314L63 305H52Z" fillRule="evenodd" />
      <path d="M94 296H103V313H123V296H132V340H123V322H103V340H94Z" />
      <path d="M166 296H204V305H175V331H195V322H184V314H204V340H166Z" />
      <path d="M217 340V307L228 296H244L255 307V340H246V325H226V340H217ZM226 316H246V311L240 305H232L226 311V316Z" fillRule="evenodd" />
      <path d="M268 340V296H278L291 316L304 296H314V340H305V312L291 333L277 312V340Z" />
      <path d="M327 296H363V305H336V313H359V322H336V331H363V340H327Z" />
      <path d="M376 296H414V305H385V313H414V340H376V331H405V322H376Z" />
    </g>
    <path d="M225 365H255" stroke="#bd9d66" strokeWidth="2" />
  </svg>;
}
