import { useId, type ReactNode } from 'react';
import type { AfterimageAssetId } from '@/lib/showdown/afterimage/types';
import './afterimageArt.css';

/** Original vector miniatures. Kept local, deterministic and ready before study begins. */
const AFTERIMAGE_ART_LABELS: Record<AfterimageAssetId, string> = {
  book: 'Book', lantern: 'Lantern', key: 'Key', orb: 'Crystal ball', flask: 'Flask', compass: 'Compass',
  cup: 'Teacup', clock: 'Mantel clock', flower: 'Flower', shell: 'Seashell', anchor: 'Anchor', fish: 'Fish',
  bell: 'Bell', telescope: 'Telescope', candle: 'Candle', teapot: 'Teapot', crown: 'Crown', crystal: 'Crystal',
  quill: 'Quill and ink', globe: 'Globe', scroll: 'Scroll', acorn: 'Acorn', pear: 'Pear',
  watering_can: 'Watering can', gear: 'Gear', bottle: 'Bottle', star: 'Star ornament', map: 'Map',
  satchel: 'Satchel', feather: 'Feather',
};

const P = {
  ink: '#35483f', cream: '#fff3d5', paper: '#f2dfb4', amber: '#e5ab4f', brass: '#b88743', coral: '#dc8b74',
  rose: '#efb5a5', teal: '#70ada5', deepTeal: '#427c79', forest: '#57785b', pale: '#c5d7b7', blue: '#779cab',
  navy: '#465e6e', brown: '#a57852', wood: '#c99a69', white: '#fffdf2',
};

interface Paint { glass: string; paper: string; metal: string; glow: string }
function shape(assetId: AfterimageAssetId, paint: Paint): ReactNode {
  switch (assetId) {
    case 'book': return <>
      <path d="M9 30Q27 24 49 33Q69 22 91 29L88 76Q68 71 50 79Q29 71 12 77Z" fill={P.coral} />
      <path d="M15 25Q31 20 49 30V73Q31 66 16 71ZM51 30Q70 20 85 25L84 70Q67 66 51 73Z" fill={paint.paper} />
      <path d="M50 30V78M22 36Q33 34 43 38M22 45Q33 43 43 47M22 54Q33 52 43 56M58 37Q69 32 78 34M58 46Q69 41 78 43M58 55Q69 50 78 52" fill="none" stroke={P.brown} strokeWidth="2" />
      <path d="M71 22V45L66 41L61 47V26" fill={P.teal} />
    </>;
    case 'lantern': return <>
      <path d="M35 24V18C35 3 65 3 65 18V24" fill="none" />
      <path d="M29 25L37 15H63L72 25L66 32H34Z" fill={P.forest} />
      <path d="M28 30H72L69 77H31Z" fill={paint.glow} />
      <path d="M28 30H72M34 31V76M66 31V76M30 58H70" fill="none" />
      <path d="M25 77H75L80 86H20Z" fill={P.forest} />
      <path d="M51 42C38 55 42 65 50 67C60 64 63 56 51 42Z" fill={P.white} stroke={P.brass} strokeWidth="2" />
    </>;
    case 'key': return <g transform="rotate(-32 50 50)">
      <circle cx="32" cy="32" r="19" fill={paint.metal} />
      <circle cx="32" cy="32" r="8" fill={P.cream} />
      <path d="M31 51V86H41V77H51V67H41V51" fill={paint.metal} />
      <path d="M23 25Q29 18 36 23" fill="none" stroke={P.cream} strokeWidth="3" />
    </g>;
    case 'orb': return <>
      <circle cx="50" cy="39" r="29" fill={paint.glass} />
      <path d="M28 63Q50 75 72 63L67 76H33Z" fill={P.brass} />
      <path d="M36 76L29 89M64 76L71 89M29 89H71" fill="none" strokeWidth="5" />
      <path d="M47 20L51 32L64 36L51 41L47 54L43 41L32 36L43 32Z" fill={P.cream} stroke="none" />
      <path d="M29 27Q34 15 46 14" fill="none" stroke={P.white} strokeWidth="4" opacity=".7" />
    </>;
    case 'flask': return <>
      <path d="M40 12H60V22H56V39L76 70Q84 87 66 89H34Q16 87 24 70L44 39V22H40Z" fill={paint.glass} />
      <path d="M32 62Q48 54 68 62L75 75Q78 83 65 84H35Q22 83 27 74Z" fill={P.coral} stroke="none" />
      <path d="M40 12H60V22H40Z" fill={P.wood} />
      <circle cx="43" cy="70" r="3" fill={P.cream} stroke="none" /><circle cx="57" cy="62" r="2" fill={P.cream} stroke="none" />
      <path d="M35 49L30 58" fill="none" stroke={P.white} strokeWidth="4" />
    </>;
    case 'compass': return <>
      <path d="M44 16V8H56V16" fill={P.brass} />
      <circle cx="50" cy="53" r="35" fill={paint.metal} /><circle cx="50" cy="53" r="28" fill={P.cream} />
      <path d="M50 27V33M50 73V79M24 53H30M70 53H76M32 35L36 39M64 67L68 71M32 71L36 67M64 39L68 35" fill="none" strokeWidth="2" />
      <path d="M61 33L54 57L39 73L46 49Z" fill={P.coral} /><path d="M61 33L46 49L39 73L54 57Z" fill={P.teal} />
      <circle cx="50" cy="53" r="3" fill={P.ink} stroke="none" />
    </>;
    case 'cup': return <>
      <ellipse cx="48" cy="82" rx="35" ry="7" fill={P.paper} />
      <path d="M71 42H79Q95 44 87 60Q83 68 72 66" fill="none" strokeWidth="7" />
      <path d="M22 37H73L69 67Q64 79 47 79Q28 78 25 66Z" fill={P.coral} />
      <ellipse cx="47" cy="37" rx="25" ry="6" fill={P.cream} /><ellipse cx="47" cy="38" rx="20" ry="3" fill={P.brown} stroke="none" />
      <path d="M36 24C28 14 43 15 36 6M52 24C44 15 60 14 53 5" fill="none" stroke={P.brass} strokeWidth="3" />
    </>;
    case 'clock': return <>
      <path d="M22 78V40C22 3 78 3 78 40V78Z" fill={P.forest} /><path d="M15 78H85V89H15Z" fill={P.wood} />
      <circle cx="50" cy="44" r="23" fill={P.cream} /><path d="M50 25V29M50 59V63M31 44H35M65 44H69" fill="none" strokeWidth="2" />
      <path d="M50 32V44L61 50" fill="none" strokeWidth="3.5" /><circle cx="50" cy="44" r="3" fill={P.brass} />
      <path d="M33 72H67" fill="none" stroke={P.pale} strokeWidth="2" />
    </>;
    case 'flower': return <>
      <path d="M49 82L50 41M49 65Q25 49 22 65Q31 78 49 71M50 56Q73 44 76 56Q66 70 50 64" fill={P.forest} />
      <path d="M50 16C38 1 28 15 35 27C16 22 13 41 33 43C20 57 36 69 49 51C61 69 79 57 66 43C86 42 84 23 66 27C74 12 61 2 50 16Z" fill={P.coral} />
      <circle cx="50" cy="34" r="12" fill={P.amber} /><circle cx="47" cy="31" r="3" fill={P.cream} stroke="none" />
    </>;
    case 'shell': return <>
      <path d="M49 85L15 63C-2 37 20 14 32 23C31 5 51 1 61 21C74 10 96 29 87 50C99 62 79 80 61 79Z" fill={P.rose} />
      <path d="M49 82L20 40M49 82L36 23M49 82L52 18M49 82L69 29M49 82L84 49" fill="none" stroke={P.brown} strokeWidth="2.5" />
      <path d="M39 84H61L57 91H43Z" fill={P.amber} />
    </>;
    case 'anchor': return <>
      <circle cx="50" cy="17" r="11" fill="none" stroke={P.navy} strokeWidth="7" />
      <path d="M50 29V83M30 42H70M50 83Q20 78 18 57M50 83Q80 78 82 57" fill="none" stroke={P.navy} strokeWidth="8" />
      <path d="M10 63L17 49L28 60M72 60L83 49L90 63" fill={P.navy} stroke={P.navy} />
      <path d="M58 30Q68 45 57 56Q40 67 42 80" fill="none" stroke={P.brass} strokeWidth="3" />
    </>;
    case 'fish': return <>
      <path d="M71 49L94 26L91 73Z" fill={P.coral} /><path d="M9 49Q35 13 70 40Q79 49 70 59Q35 85 9 49Z" fill={P.teal} />
      <path d="M36 30L47 15L58 35M38 67L51 79L60 62" fill={P.blue} />
      <path d="M29 31Q42 47 30 66M44 42L52 49L44 57" fill="none" strokeWidth="2" /><circle cx="21" cy="45" r="3" fill={P.ink} stroke="none" />
    </>;
    case 'bell': return <>
      <path d="M43 19Q37 5 50 5Q63 5 57 19" fill="none" strokeWidth="4" /><path d="M21 71Q31 63 31 43C31 13 69 13 69 43Q69 63 79 71Z" fill={paint.metal} />
      <ellipse cx="50" cy="73" rx="30" ry="7" fill={P.brass} /><circle cx="50" cy="81" r="8" fill={P.wood} />
      <path d="M39 34Q34 42 35 52" fill="none" stroke={P.cream} strokeWidth="4" />
    </>;
    case 'telescope': return <>
      <path d="M50 55L29 88M50 55L72 88M50 55V88" fill="none" stroke={P.navy} strokeWidth="5" />
      <g transform="rotate(-22 49 37)"><path d="M14 25H70V49H14Z" fill={P.coral} /><path d="M70 29H87V45H70Z" fill={P.brass} /><ellipse cx="13" cy="37" rx="7" ry="15" fill={P.teal} /><path d="M23 25V49M61 25V49" fill="none" stroke={P.cream} strokeWidth="4" /></g>
      <path d="M43 57V49H58V57Z" fill={P.brass} />
    </>;
    case 'candle': return <>
      <ellipse cx="49" cy="84" rx="34" ry="7" fill={P.brass} /><path d="M31 29H66V80H31Z" fill={paint.paper} />
      <path d="M31 31Q37 24 41 35V45Q47 52 49 43V36Q55 29 59 37V48Q66 53 66 43V30" fill={P.white} strokeWidth="2" />
      <path d="M49 28C27 15 49 6 52 1C54 10 72 19 49 28Z" fill={P.amber} /><path d="M49 18V30" fill="none" strokeWidth="2" />
    </>;
    case 'teapot': return <>
      <path d="M73 35Q97 21 92 50Q89 66 76 59" fill="none" strokeWidth="7" /><path d="M28 43L9 31Q12 55 30 63" fill={P.teal} />
      <path d="M27 36Q50 25 73 36L80 63Q77 84 49 84Q24 84 22 65Z" fill={P.forest} />
      <ellipse cx="50" cy="34" rx="25" ry="6" fill={P.teal} /><path d="M42 26Q50 16 58 26V33H42Z" fill={P.amber} />
      <path d="M35 50Q49 40 66 50M36 56Q50 48 66 56" fill="none" stroke={P.pale} strokeWidth="2" />
    </>;
    case 'crown': return <>
      <path d="M19 70L12 26L33 44L50 15L67 44L89 26L81 70Z" fill={paint.metal} /><path d="M19 70H81V85H19Z" fill={P.brass} />
      <path d="M30 54L36 61L30 67L24 61ZM50 42L58 51L50 61L42 51ZM70 54L76 61L70 67L64 61Z" fill={P.coral} />
      <circle cx="12" cy="24" r="5" fill={P.cream} /><circle cx="50" cy="13" r="5" fill={P.cream} /><circle cx="89" cy="24" r="5" fill={P.cream} />
    </>;
    case 'crystal': return <>
      <path d="M23 29L49 10L76 29L83 69L50 90L17 69Z" fill={paint.glass} /><path d="M49 10L36 36L50 90L64 36Z" fill={P.teal} /><path d="M23 29L36 36H64L76 29M17 69L36 36M64 36L83 69" fill="none" stroke={P.white} strokeWidth="2" opacity=".8" />
      <path d="M25 32L23 51" fill="none" stroke={P.white} strokeWidth="3" />
    </>;
    case 'quill': return <>
      <path d="M19 63H51L58 86Q54 93 35 93Q16 93 12 86Z" fill={P.navy} /><ellipse cx="35" cy="64" rx="16" ry="5" fill={P.brass} />
      <path d="M35 67L49 27Q70 7 88 8Q83 31 61 43L46 49Z" fill={P.cream} /><path d="M37 65L76 19M52 42L53 24M58 35L72 35M63 30L65 15" fill="none" stroke={P.brass} strokeWidth="2" />
    </>;
    case 'globe': return <>
      <path d="M37 10Q14 22 15 43Q18 69 49 73M35 8L27 4M49 73L53 80M38 89H73M56 74V88" fill="none" stroke={P.brass} strokeWidth="5" />
      <circle cx="53" cy="38" r="29" fill={P.blue} /><path d="M31 20L47 14L52 25L44 31L48 42L35 46L26 36ZM64 24L78 29L79 45L69 48L65 62L56 58L58 44L51 38Z" fill={P.pale} strokeWidth="1.6" /><path d="M29 34Q53 28 79 39M35 17Q48 42 69 59" fill="none" stroke={P.cream} strokeWidth="1.5" opacity=".6" />
    </>;
    case 'scroll': return <>
      <path d="M28 15H81Q91 15 87 28L78 76Q75 88 64 88H17L29 29H17Q10 14 28 15Z" fill={paint.paper} /><path d="M28 15Q37 19 29 29H17M64 88Q53 84 59 75H78M37 36H71M34 45H67M31 54H57" fill="none" stroke={P.brown} strokeWidth="2" /><path d="M49 14L59 18L48 76L38 73Z" fill={P.coral} /><path d="M42 49L36 44L42 40L49 46L57 42L60 48L49 53Z" fill={P.coral} />
    </>;
    case 'acorn': return <>
      <path d="M27 43H74Q77 77 50 92Q22 76 27 43Z" fill={P.amber} /><path d="M20 46Q23 20 51 22Q78 22 81 46Z" fill={P.forest} /><path d="M50 23Q44 10 58 8" fill="none" stroke={P.brown} strokeWidth="5" />
      <path d="M31 31L36 38L42 29L48 39L55 29L62 39L68 32M36 56Q34 69 44 78" fill="none" stroke={P.pale} strokeWidth="2" />
    </>;
    case 'pear': return <>
      <path d="M49 19Q66 16 66 39Q65 47 75 60Q89 87 51 90Q14 90 25 63Q35 49 34 37Q34 19 49 19Z" fill={P.amber} /><path d="M50 21Q47 9 57 5" fill="none" stroke={P.brown} strokeWidth="4" /><path d="M55 13Q76 7 78 19Q65 28 55 13Z" fill={P.forest} /><path d="M33 58Q27 68 32 76" fill="none" stroke={P.cream} strokeWidth="5" /><circle cx="62" cy="70" r="1.5" fill={P.brass} stroke="none" /><circle cx="56" cy="80" r="1.5" fill={P.brass} stroke="none" />
    </>;
    case 'watering_can': return <>
      <path d="M33 32Q28 3 57 12Q72 19 62 35" fill="none" stroke={P.deepTeal} strokeWidth="7" /><path d="M25 39L8 30L13 20L37 35" fill={P.teal} /><path d="M29 38Q49 29 67 39L73 81Q51 91 24 80Z" fill={P.teal} /><path d="M66 49L84 30L91 38L71 68" fill={P.deepTeal} /><path d="M82 25L96 34L91 42L78 33Z" fill={P.brass} /><path d="M36 47V72M42 46V74" fill="none" stroke={P.pale} strokeWidth="2" />
    </>;
    case 'gear': return <>
      <path d="M41 8H59L62 21L73 25L85 19L94 35L84 45V56L94 65L85 81L72 75L62 79L59 92H41L38 79L27 75L15 81L6 65L16 55V44L6 35L15 19L28 25L38 21Z" fill={paint.metal} /><circle cx="50" cy="50" r="20" fill={P.cream} /><circle cx="50" cy="50" r="10" fill={P.teal} /><path d="M28 37Q34 23 50 24" fill="none" stroke={P.cream} strokeWidth="3" />
    </>;
    case 'bottle': return <>
      <path d="M41 13H59V34Q73 39 73 53V85Q51 93 27 85V53Q27 39 41 34Z" fill={P.forest} /><path d="M40 6H60V17H40Z" fill={P.wood} /><path d="M30 53H70V76H30Z" fill={paint.paper} /><path d="M44 57L56 64L44 72Z" fill={P.coral} /><path d="M35 37V47M35 79V83" fill="none" stroke={P.pale} strokeWidth="3" />
    </>;
    case 'star': return <>
      <path d="M50 7L62 34L92 37L70 58L76 88L50 73L24 88L30 58L8 37L38 34Z" fill={paint.metal} /><path d="M50 7V52L8 37M50 52L76 88M50 52L24 88M50 52L92 37" fill="none" stroke={P.cream} strokeWidth="2" /><circle cx="50" cy="52" r="8" fill={P.coral} />
    </>;
    case 'map': return <>
      <path d="M9 22L35 13L63 24L91 14V77L65 88L35 76L9 87Z" fill={paint.paper} /><path d="M35 14V76M63 24V86" fill="none" stroke={P.brown} strokeWidth="2" /><path d="M16 38Q36 51 47 42T82 47M21 68Q40 57 55 67T82 69" fill="none" stroke={P.teal} strokeWidth="5" /><path d="M67 37L77 28M67 28L77 37" fill="none" stroke={P.coral} strokeWidth="4" /><circle cx="24" cy="29" r="3" fill={P.brass} stroke="none" />
    </>;
    case 'satchel': return <>
      <path d="M33 27V17Q50 5 68 17V27" fill="none" stroke={P.brown} strokeWidth="6" /><path d="M18 29H82L88 82Q50 95 12 82Z" fill={P.coral} /><path d="M18 28H82V49L51 59L18 49Z" fill={P.wood} /><path d="M44 44H58V69H44Z" fill={P.brass} /><path d="M48 49H54V60H48Z" fill={P.cream} /><path d="M24 68V78M76 68V78" fill="none" stroke={P.paper} strokeWidth="2" />
    </>;
    case 'feather': return <>
      <path d="M23 83Q21 45 47 19Q64 5 85 8Q86 32 67 49L51 54L57 60L44 68L40 64L32 80Z" fill={P.rose} /><path d="M16 94L73 20M34 71L30 53M45 56L42 36M58 40L57 24M36 68L49 67M48 52L61 51M60 37L75 35" fill="none" stroke={P.brown} strokeWidth="2.5" />
    </>;
  }
}

export interface AfterimageArtProps {
  assetId: AfterimageAssetId;
  label?: string;
  decorative?: boolean;
  className?: string;
}

export function AfterimageArt({ assetId, label, decorative = false, className = '' }: AfterimageArtProps) {
  const id = `ai-art-${useId().replace(/:/g, '')}`;
  const paint = { glass: `url(#${id}-glass)`, paper: `url(#${id}-paper)`, metal: `url(#${id}-metal)`, glow: `url(#${id}-glow)` };
  return <svg className={`ai-object-art ${className}`} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : label ?? AFTERIMAGE_ART_LABELS[assetId]} aria-hidden={decorative || undefined} focusable="false" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d3eee0" /><stop offset=".6" stopColor={P.teal} /><stop offset="1" stopColor={P.deepTeal} /></linearGradient>
      <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={P.white} /><stop offset="1" stopColor={P.paper} /></linearGradient>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f5d68a" /><stop offset=".55" stopColor={P.amber} /><stop offset="1" stopColor={P.brass} /></linearGradient>
      <radialGradient id={`${id}-glow`}><stop stopColor="#fff6bc" /><stop offset="1" stopColor="#edbd67" /></radialGradient>
    </defs>
    <ellipse cx="50" cy="92" rx="32" ry="5" fill="#3e483c" opacity=".12" />
    <g fill="none" stroke={P.ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{shape(assetId, paint)}</g>
  </svg>;
}
