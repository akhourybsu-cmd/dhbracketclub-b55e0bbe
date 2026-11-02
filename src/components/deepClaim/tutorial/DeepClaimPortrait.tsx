import type { TutorialExpression, TutorialSpeakerId } from '@/lib/deepClaim/tutorial/types';

export interface DeepClaimPortraitProps {
  speaker: TutorialSpeakerId;
  expression?: TutorialExpression;
  className?: string;
  decorative?: boolean;
  label?: string;
}
const PEOPLE = {
  gus: { name: 'Gus “Gravel” Calloway', skin: '#c19c79', light: '#d9b590', shade: '#977453', hair: '#c6c6ab', coat: '#596c53', trim: '#ae9860', hat: '#927c4e', eyes: '#34443b' },
  mara: { name: 'Mara Flint', skin: '#cd9f77', light: '#e0b58c', shade: '#9b7054', hair: '#864e38', coat: '#a66c43', trim: '#ceae70', hat: '#bc9d58', eyes: '#39483c' },
  ivo: { name: 'Ivo Vale', skin: '#ad825f', light: '#c79d72', shade: '#805b48', hair: '#383f37', coat: '#77836b', trim: '#c6b68a', hat: '#8f9c7a', eyes: '#333d38' },
  tessa: { name: 'Tessa Pike', skin: '#876348', light: '#a27b57', shade: '#604c3c', hair: '#282f31', coat: '#657a82', trim: '#bfa06a', hat: '#b1975c', eyes: '#202d2d' },
} as const;

/** Original narrative portraits; Gus is an adviser, never an employee or economic record. */
export function DeepClaimPortrait({ speaker, expression = 'neutral', className = '', decorative = false, label }: DeepClaimPortraitProps) {
  const person = PEOPLE[speaker], gus = speaker === 'gus';
  const smile = expression === 'amused' || expression === 'proud', raised = expression === 'excited';
  const brow = gus ? '#b7b79e' : person.hair;
  return <svg viewBox="0 0 96 112" width="100%" height="100%" className={`dc-tutorial-portrait ${className}`} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : label ?? `${person.name}, ${expression}`} aria-hidden={decorative || undefined} data-dc-portrait={speaker} data-dc-expression={expression} shapeRendering="crispEdges" focusable="false" style={{ display: 'block', imageRendering: 'pixelated' }}>
    <path d="M8 0H88V4H94V108H88V112H8V108H2V4H8Z" fill="#2d3d33" /><path d="M8 5H88V107H8Z" fill="#52644e" /><path d="M12 9H84V101H12Z" fill="#708069" />
    <path d="M14 13H17V34H14ZM19 10H38V13H19ZM74 78H82V100H74Z" fill="#a6ad80" opacity=".35" />
    <path d="M13 88H23V80H35V75H63V80H76V88H85V112H13Z" fill="#29382f" />
    <path d="M18 89H28V82H39V78H61V82H72V89H80V112H18Z" fill={person.coat} />
    <path d="M28 88H34V112H28ZM65 88H71V112H65Z" fill={person.trim} /><path d="M31 91H34V95H31ZM66 91H69V95H66ZM43 104H59V107H43Z" fill="#dfc88a" />
    <path d="M38 72H62V88H38Z" fill={person.shade} /><path d="M40 75H60V85H40Z" fill={person.skin} />
    <path d="M24 42H31V65H24ZM68 42H75V65H68Z" fill={person.shade} /><path d="M27 44H32V60H27ZM68 44H72V60H68Z" fill={person.skin} />
    <path d="M31 30H65V36H70V67H65V76H59V81H41V77H35V70H30V41H27V34H31Z" fill={person.hair} />
    <path d="M34 34H63V39H68V64H63V73H57V77H42V73H36V65H32V42H34Z" fill={person.skin} />
    <path d="M35 38H41V49H35ZM40 36H59V39H40ZM58 58H64V65H58Z" fill={person.light} />
    <path d="M47 50H53V62H47ZM45 60H56V63H45Z" fill={person.shade} /><path d="M48 52H51V60H48Z" fill={person.light} />
    {gus ? <><path d="M29 35H35V58H29ZM64 34H70V58H64ZM34 63H40V71H58V63H65V78H59V85H41V81H35Z" fill={person.hair} /><path d="M37 65H45V69H55V65H62V73H57V79H43V76H39Z" fill="#dbd5b6" /><path d="M37 59H45V62H55V59H62V66H54V64H45V66H37Z" fill="#ded8bd" /><path d="M39 74H42V79H39ZM57 72H60V77H57ZM44 81H55V83H44Z" fill="#a2aa92" /></> : speaker === 'mara' ? <><path d="M28 36H34V65H29ZM64 36H70V70H65V91H59V85H62V71H64Z" fill={person.hair} /><path d="M64 68H69V74H64ZM62 78H67V84H62Z" fill="#b27047" /><path d="M61 89H66V93H61Z" fill="#d5b174" /></> : speaker === 'ivo' ? <><path d="M30 33H35V47H30ZM64 33H69V49H64ZM37 68H42V74H59V68H64V77H58V81H44V77H37Z" fill={person.hair} /><path d="M40 72H43V76H40ZM57 72H60V76H57Z" fill="#586049" /></> : <><path d="M28 34H35V41H29V52H26V40H28ZM63 34H70V40H73V50H68V43H63Z" fill={person.hair} /><path d="M31 73H37V84H31ZM63 72H69V83H63Z" fill="#344951" /><path d="M35 79H41V88H35ZM58 79H65V88H58Z" fill="#829b94" /></>}
    <g data-dc-portrait-expression={expression}>
      {expression === 'skeptical' ? <><path d="M35 42H44V44H35ZM57 46H65V48H57Z" fill={brow} /><path d="M37 48H44V51H37ZM57 50H64V52H57Z" fill={person.eyes} /><path d="M44 68H51V70H44ZM51 67H57V69H51Z" fill="#684b39" /></> : expression === 'concerned' ? <><path d="M35 44H39V46H35ZM39 42H45V45H39ZM56 42H62V45H56ZM62 44H65V46H62Z" fill={brow} /><path d="M38 49H43V53H38ZM58 49H63V53H58Z" fill={person.eyes} /><path d="M43 68H47V66H54V68H58V70H54V69H47V70H43Z" fill="#684b39" /></> : <><path d={raised ? 'M35 39H45V42H35ZM56 39H66V42H56Z' : smile ? 'M35 43H44V45H35ZM57 42H65V44H57Z' : 'M35 44H45V47H35ZM56 44H66V47H56Z'} fill={brow} />{expression === 'amused' ? <path d="M37 50H40V48H44V51H41V53H37ZM57 49H60V47H64V50H61V52H57Z" fill={person.eyes} /> : expression === 'proud' ? <path d="M37 49H44V51H37ZM57 49H64V51H57Z" fill={person.eyes} /> : <><path d={raised ? 'M37 45H44V53H37ZM57 45H64V53H57Z' : 'M38 49H43V53H38ZM58 49H63V53H58Z'} fill={person.eyes} /><path d={raised ? 'M38 45H41V48H38ZM58 45H61V48H58Z' : 'M38 49H40V51H38ZM58 49H60V51H58Z'} fill="#f0dfb9" /></>}{raised ? <><path d="M43 66H58V73H54V76H47V73H43Z" fill="#574333" /><path d="M45 66H56V68H45Z" fill="#ead8b5" /></> : smile ? <path d={expression === 'amused' ? 'M42 66H45V69H56V66H59V71H56V73H45V71H42Z' : 'M43 67H46V69H55V67H58V70H55V72H46V70H43Z'} fill="#654d3b" /> : <path d="M43 68H57V70H43Z" fill="#79563f" />}</>}
      {gus && <><path d="M34 53H38V55H34ZM63 53H67V55H63ZM37 56H41V57H37ZM60 56H64V57H60Z" fill="#9b7959" /><path d="M41 60H45V61H41ZM55 60H59V61H55Z" fill="#f0e0bf" /></>}
    </g>
    {speaker === 'ivo' && <g><path d="M33 46H47V56H33ZM54 46H68V56H54Z" fill="none" stroke="#b1a16d" strokeWidth="2" /><path d="M47 49H54V51H47ZM30 48H34V50H30ZM67 48H71V50H67Z" fill="#c6b57e" /></g>}
    {gus ? <><path d="M23 27H31V16H39V11H61V15H68V27H78V34H22V30H18V27Z" fill="#564b34" /><path d="M28 25H33V17H40V14H59V17H65V26H73V30H25V27H28Z" fill={person.hat} /><path d="M35 17H46V19H35ZM27 28H69V30H27Z" fill="#c5b478" /><path d="M33 23H65V26H33Z" fill="#4c5d42" /><path d="M56 20H63V26H56Z" fill="#bca26a" /><path d="M58 21H62V24H58Z" fill="#e1cc8f" /><path d="M67 29H72V31H67Z" fill="#8d774c" /></> : <><path d="M25 28H31V18H38V14H62V18H69V28H75V34H25Z" fill="#535439" /><path d="M31 27V20H39V17H61V20H67V28H72V31H28V28Z" fill={person.hat} /><path d="M38 18H49V20H38ZM28 29H70V31H28Z" fill="#e0cd91" /><path d="M46 17H51V29H46Z" fill="#806d43" /><path d="M65 24H74V33H65Z" fill="#3e5144" /><path d="M68 26H73V30H68Z" fill="#f1d99a" /></>}
    {expression === 'excited' && gus && <><path d="M13 83H20V75H17V68H21V73H24V80H27V89H23V96H15Z" fill={person.shade} /><path d="M16 84H21V77H19V71H21V78H24V87H21V91H16Z" fill={person.skin} /><path d="M15 91H25V103H15Z" fill={person.coat} /></>}
    {expression === 'proud' && gus && <><path d="M25 101H38V97H61V101H73V108H25Z" fill="#3f5544" /><path d="M40 98H53V104H40Z" fill={person.skin} /><path d="M27 102H42V108H27ZM54 101H72V107H54Z" fill="#7d8963" /></>}
    <path d="M8 4H20V6H8ZM6 6H8V18H6ZM78 106H88V108H78Z" fill="#c5ae75" />
  </svg>;
}
