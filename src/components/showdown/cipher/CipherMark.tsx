import { useId } from 'react';
import './cipherArt.css';

export interface CipherMarkProps { className?: string; label?: string }

export function CipherMark({ className = '', label = 'Cipher Duel' }: CipherMarkProps) {
  const id = `cipher-mark-${useId().replace(/:/g, '')}`;
  return <svg className={`cd-mark cipher-mark ${className}`} viewBox="0 0 120 120" role="img" aria-label={label} focusable="false">
    <defs><linearGradient id={`${id}-plate`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#4c5d57" /><stop offset="1" stopColor="#172522" /></linearGradient><linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d6c49c" /><stop offset="1" stopColor="#7a715b" /></linearGradient></defs>
    <rect x="7" y="7" width="106" height="106" rx="28" fill={`url(#${id}-edge)`} />
    <rect x="11" y="10" width="98" height="98" rx="25" fill={`url(#${id}-plate)`} stroke="#c6b58d" strokeWidth="1.2" />
    <path d="M28 16H84M16 30V76" stroke="#f1e2bb" strokeWidth="1.3" opacity=".25" strokeLinecap="round" />
    {[{ x: 39, y: 40, fill: '#d88273', light: '#f2b7a2' }, { x: 80, y: 40, fill: '#6fa8bc', light: '#b3d5db' }, { x: 39, y: 80, fill: '#83a78a', light: '#c0d7aa' }, { x: 80, y: 80, fill: '#d4ae68', light: '#f1d796' }].map(({ x, y, fill, light }) => <g key={x + y * 3}>
      <circle cx={x} cy={y + 3} r="17" fill="#10201c" /><circle cx={x} cy={y} r="14" fill={fill} stroke="#23322e" strokeWidth="1.2" /><path d={`M${x - 10} ${y - 4}Q${x - 6} ${y - 13} ${x + 4} ${y - 11}`} stroke={light} strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </g>)}
    <path d="M39 31L46 44H32Z" fill="none" stroke="#fff2d8" strokeWidth="2" strokeLinejoin="round" /><circle cx="80" cy="40" r="7" fill="none" stroke="#f4f4dd" strokeWidth="2" /><path d="M39 73V87M32 80H46" stroke="#f5f3d7" strokeWidth="2.5" strokeLinecap="round" /><path d="M74 75H86V85H74Z" stroke="#4d452f" fill="none" strokeWidth="2" />
  </svg>;
}
