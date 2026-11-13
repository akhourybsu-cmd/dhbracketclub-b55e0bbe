import { useId } from 'react';

/** Small original vector scenes share the slot shapes used on the live roster. */
export function LineupArtwork({ template = 'custom', className = '' }: { template?: string; className?: string }) {
  const id = useId().replace(/:/g, '');
  const football = template.startsWith('football');
  return <svg className={`da-lineup-art ${className}`} viewBox="0 0 320 160" aria-hidden="true" focusable="false">
    <defs>
      <pattern id={`lineup-grid-${id}`} width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="currentColor" strokeWidth=".6" opacity=".12" /></pattern>
    </defs>
    <rect x="7" y="7" width="306" height="146" rx="19" className="da-lineup-art-surface" />
    <rect x="7" y="7" width="306" height="146" rx="19" fill={`url(#lineup-grid-${id})`} />
    {template === 'breakfast' ? <g className="da-lineup-art-stroke">
      <ellipse cx="140" cy="92" rx="65" ry="45" className="da-lineup-art-solid" />
      <ellipse cx="140" cy="92" rx="49" ry="31" fill="none" opacity=".5" />
      <path d="M110 90q5-21 27-16 23-13 32 9 10 22-11 24-14 12-27-1-22 6-21-16Z" className="da-lineup-art-paper" />
      <circle cx="140" cy="89" r="12" className="da-lineup-art-accent" />
      <path d="M57 48v83m-8-83v25q8 11 16 0V48m-8 28v55m166-78v52q0 15 21 15t21-15V53Z" fill="none" />
      <path d="M265 60h9q17 15-9 27m-28-54q-10-9 0-17m14 17q-10-9 0-17" fill="none" />
      <path d="m208 134 13-11 26 9-13 10Z" className="da-lineup-art-accent" />
    </g> : football ? <g className="da-lineup-art-stroke">
      <rect x="34" y="28" width="252" height="104" rx="5" fill="none" opacity=".65" />
      {[64, 102, 140, 178, 216, 254].map(x => <path key={x} d={`M${x} 29v102`} fill="none" opacity=".3" />)}
      <path d="M80 112V82h74V44m0 38h77v29" fill="none" strokeDasharray="5 5" />
      {[[80, 112], [154, 82], [154, 44], [231, 111]].map(([x, y], i) => <g key={x + y}><circle cx={x} cy={y} r="13" className={i === 1 ? 'da-lineup-art-accent' : 'da-lineup-art-solid'} /><path d={`M${x-4} ${y-4}l8 8m0-8-8 8`} fill="none" /></g>)}
      <ellipse cx="267" cy="41" rx="16" ry="9" transform="rotate(-30 267 41)" className="da-lineup-art-accent" /><path d="m262 44 10-7m-8 2 3 5m0-7 3 5" fill="none" />
    </g> : template === 'band' ? <g className="da-lineup-art-stroke">
      <path d="M38 132h245M63 37l-13 65m38-67 4 56m144-57 19 69" fill="none" opacity=".35" />
      <rect x="97" y="94" width="45" height="34" rx="4" className="da-lineup-art-solid" /><circle cx="178" cy="107" r="24" className="da-lineup-art-solid" /><circle cx="178" cy="107" r="15" fill="none" opacity=".6" />
      <path d="M229 57v73m-9-73h18m-9 73-11 8m11-8 11 8M150 62v25m-13-23 28-4" fill="none" />
      <path d="M72 64v29q-18-9-22 8-4 22 11 22 17 3 21-12l2-47Z" className="da-lineup-art-accent" /><path d="M76 61V37h9v25m-8 39 3 13" fill="none" />
      <circle cx="230" cy="47" r="11" className="da-lineup-art-accent" /><path d="m220 54 17-13" fill="none" />
      <path d="M111 102h17m-17 9h17" fill="none" />
    </g> : template === 'heist' ? <g className="da-lineup-art-stroke">
      <path d="M33 35h110v90H33Zm110 0h139v90H143m-61-90v41h61m75 49V88h64" fill="none" opacity=".55" />
      <path d="M56 108h42V55h85v40h61" fill="none" strokeDasharray="5 5" />
      <circle cx="237" cy="59" r="24" className="da-lineup-art-solid" /><circle cx="237" cy="59" r="15" fill="none" /><path d="M237 44v30m-15-15h30m-25-10 20 20m0-20-20 20" fill="none" />
      <circle cx="56" cy="108" r="8" className="da-lineup-art-accent" /><circle cx="98" cy="55" r="8" className="da-lineup-art-accent" /><circle cx="183" cy="95" r="8" className="da-lineup-art-accent" />
    </g> : template === 'movie-cast' ? <g className="da-lineup-art-stroke">
      <rect x="42" y="36" width="235" height="97" rx="8" className="da-lineup-art-solid" />
      <path d="m42 37 217-20 8 26-225 20Z" className="da-lineup-art-accent" /><path d="m70 35 16 24m31-28 16 24m31-28 16 24m31-28 16 24" fill="none" />
      {[90, 159, 228].map((x, i) => <g key={x}><circle cx={x} cy="88" r="12" className={i === 1 ? 'da-lineup-art-accent' : 'da-lineup-art-paper'} /><path d={`M${x-18} 122q1-24 18-24t18 24`} fill="none" /></g>)}
    </g> : <g className="da-lineup-art-stroke">
      {[[61, 43], [136, 43], [211, 43], [61, 93], [136, 93], [211, 93]].map(([x, y], i) => <g key={x + y}><rect x={x} y={y} width="48" height="35" rx="9" className={i === 1 || i === 5 ? 'da-lineup-art-accent' : 'da-lineup-art-solid'} /><path d={`M${x+18} ${y+17}h12m-6-6v12`} fill="none" /></g>)}
    </g>}
    <path d="M20 18h20m-20 0v18m280 106h-20m20 0v-18" fill="none" stroke="currentColor" opacity=".5" />
  </svg>;
}
