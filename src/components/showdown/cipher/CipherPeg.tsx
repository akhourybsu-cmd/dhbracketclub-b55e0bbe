import { useId, type CSSProperties } from 'react';
import type { CipherColorId } from '@/lib/showdown/cipher/types';
import './cipherArt.css';

const PALETTE = {
  red: { light: '#ffb4a1', face: '#dc5c56', edge: '#822f3a', ink: '#fff0dc', glyph: 'M50 28L73 68H27Z' },
  blue: { light: '#a9dcf4', face: '#4d9ac7', edge: '#275270', ink: '#f2f5e8', glyph: 'M50 28A22 22 0 1 1 49.99 28Z' },
  green: { light: '#c5e3a5', face: '#6da278', edge: '#355c48', ink: '#f7f3dc', glyph: 'M50 27V73M27 50H73' },
  yellow: { light: '#fff1b2', face: '#e4bd61', edge: '#97703c', ink: '#51442d', glyph: 'M29 34H71V66H29Z' },
  purple: { light: '#d9bfed', face: '#a181bb', edge: '#624675', ink: '#fcf0e3', glyph: 'M50 24L74 50L50 76L26 50Z' },
  orange: { light: '#ffcf9c', face: '#db9460', edge: '#905137', ink: '#4f382e', glyph: 'M26 39Q38 25 50 39T74 39M26 61Q38 47 50 61T74 61' },
} satisfies Record<CipherColorId, { light: string; face: string; edge: string; ink: string; glyph: string }>;
const SYMBOLS: Record<CipherColorId, string> = { red: 'triangle', blue: 'circle', green: 'cross', yellow: 'square', purple: 'diamond', orange: 'waves' };

export interface CipherPegProps {
  color?: CipherColorId | null;
  size?: number | string;
  label?: string;
  className?: string;
  selected?: boolean;
  decorative?: boolean;
}

/** The symbol is repeated in every context, so a color is never the only identifier. */
export function CipherPeg({ color, size, label, className = '', selected = false, decorative = false }: CipherPegProps) {
  const id = `cipher-peg-${useId().replace(/:/g, '')}`;
  const paint = color ? PALETTE[color] : undefined;
  const style: CSSProperties | undefined = size === undefined ? undefined : { width: size, height: size };
  return <svg className={`cipher-peg${paint ? ' cipher-peg--filled' : ' cipher-peg--empty'}${selected ? ' cipher-peg--selected' : ''} ${className}`} viewBox="0 0 100 100" style={style} role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : label ?? (color ? `${color} peg, ${SYMBOLS[color]} symbol` : 'Empty peg socket')} data-cipher-color={color ?? 'empty'} data-cipher-symbol={color ? SYMBOLS[color] : 'socket'} focusable="false">
    <defs>
      <linearGradient id={`${id}-rim`} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#c1b294" /><stop offset=".4" stopColor="#6e7069" /><stop offset="1" stopColor="#393f3e" /></linearGradient>
      <radialGradient id={`${id}-socket`} cx=".5" cy=".65"><stop stopColor="#172120" /><stop offset=".75" stopColor="#202b29" /><stop offset="1" stopColor="#0c1515" /></radialGradient>
      {paint && <radialGradient id={`${id}-cap`} cx=".3" cy=".22" r=".85"><stop stopColor={paint.light} /><stop offset=".42" stopColor={paint.face} /><stop offset="1" stopColor={paint.edge} /></radialGradient>}
    </defs>
    <ellipse cx="50" cy="56" rx="46" ry="42" fill="#0b1212" opacity=".25" />
    <circle cx="50" cy="49" r="43" fill={`url(#${id}-rim)`} />
    <circle cx="50" cy="49" r="38" fill={`url(#${id}-socket)`} stroke="#14201f" strokeWidth="2" />
    {!paint && <><path d="M22 58A30 30 0 0 0 78 58" fill="none" stroke="#5c6c63" strokeWidth="2.5" opacity=".5" /><circle cx="50" cy="49" r="21" fill="none" stroke="#364640" strokeWidth="1.5" opacity=".45" /></>}
    {paint && <>
      <ellipse cx="50" cy="54" rx="35" ry="36" fill={paint.edge} />
      <circle cx="50" cy="45" r="34" fill={`url(#${id}-cap)`} stroke={paint.edge} strokeWidth="1.2" />
      <path d="M25 32A29 29 0 0 1 60 19" fill="none" stroke={paint.light} strokeWidth="4" strokeLinecap="round" opacity=".8" />
      <path d={paint.glyph} transform="translate(13 8) scale(.74)" fill="none" stroke={paint.ink} strokeWidth={color === 'green' || color === 'orange' ? 7 : 5} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 70Q50 81 72 70" fill="none" stroke={paint.light} strokeWidth="1.2" opacity=".3" />
    </>}
    {selected && <circle cx="50" cy="49" r="47" fill="none" stroke="#e8d09b" strokeWidth="3" strokeDasharray="4 4" />}
  </svg>;
}

export interface CipherFeedbackProps { exact: number; colorOnly?: number; color_only?: number; className?: string; label?: string }

/** Counts supplied by the authoritative response; this cluster never denotes code positions. */
export function CipherFeedback({ exact, colorOnly, color_only, className = '', label }: CipherFeedbackProps) {
  const black = Math.max(0, Math.min(4, Math.trunc(exact)));
  const white = Math.max(0, Math.min(4 - black, Math.trunc(colorOnly ?? color_only ?? 0)));
  return <span className={`cipher-feedback ${className}`} role="img" aria-label={label ?? `${black} exact ${black === 1 ? 'match' : 'matches'}, ${white} color-only ${white === 1 ? 'match' : 'matches'}. Clues do not indicate positions.`}>
    {[0, 1, 2, 3].map(index => <span key={index} className={`cipher-feedback-pin ${index < black ? 'cipher-feedback-pin--exact' : index < black + white ? 'cipher-feedback-pin--color' : 'cipher-feedback-pin--blank'}`} aria-hidden="true" />)}
  </span>;
}
