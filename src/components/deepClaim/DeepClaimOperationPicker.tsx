import { useId } from 'react';
import { Check } from 'lucide-react';
import type { DeepClaimMode } from '@/lib/deepClaim/types';
import { CLAIM_OPERATION_COPY, CLAIM_OPERATION_NAMES } from './fieldLabels';
import './deepClaimOperationPicker.css';

export interface DeepClaimOperationPickerProps {
  value?: DeepClaimMode;
  onChange: (mode: DeepClaimMode) => void;
  disabled?: boolean;
  includeSupport?: boolean;
}

/** Small original mine vignettes; artwork illustrates intent, never predicted terrain. */
function OperationArt({ mode }: { mode: DeepClaimMode }) {
  return <svg viewBox="0 0 64 40" shapeRendering="crispEdges" aria-hidden="true" focusable="false" data-dc-operation-art={mode}>
    <path d="M0 0H64V40H0Z" fill="#263630" />
    <path d="M0 0H64V4H0ZM0 36H64V40H0Z" fill="#4a5140" />
    {mode === 'explore' && <>
      <path d="M0 4H64V36H0Z" fill="#665b45" />
      <path d="M0 15H10V10H24V7H36V12H44V31H0Z" fill="#172724" />
      <path d="M0 29H40V33H47V36H0Z" fill="#9b8356" />
      <path d="M10 11H14V30H10ZM30 9H34V30H30ZM10 10H34V14H10Z" fill="#aa8b58" />
      <path d="M14 14H17V29H14ZM28 14H30V29H28Z" fill="#594b34" />
      <path d="M44 10H49V14H44ZM50 19H54V23H50ZM45 28H50V31H45ZM56 7H61V10H56Z" fill="#998263" />
      <path d="M34 23H38V19H42V16H45V21H41V25H37V29H33V26H34Z" fill="#b38d57" />
      <path d="M34 14H42V12H47V15H51V20H48V18H43V16H37V18H33V16H34Z" fill="#b8c7b3" />
      <path d="M46 25H49V28H46ZM53 29H57V32H53ZM40 32H44V34H40Z" fill="#d0af71" />
      <path d="M20 17H23V24H20Z" fill="#e5c885" />
      <path d="M19 19H24V22H19Z" fill="#f1dda4" />
    </>}
    {mode === 'extract' && <>
      <path d="M0 4H64V36H0Z" fill="#465044" />
      <path d="M0 7H29V11H34V22H26V26H0Z" fill="#616854" />
      <path d="M4 12H9V9H13V16H9V19H4ZM17 10H22V14H27V18H21V16H17ZM11 21H15V18H20V23H16V26H11Z" fill="#b4804d" />
      <path d="M5 12H9V15H5ZM18 11H21V14H18ZM13 21H16V24H13Z" fill="#e5b779" />
      <path d="M0 32H64V36H0ZM7 35H11V39H7ZM23 35H27V39H23ZM40 35H44V39H40ZM56 35H60V39H56Z" fill="#8f7a55" />
      <path d="M0 33H64V35H0Z" fill="#b6b7a0" />
      <path d="M31 21H59V27H56V31H35V27H31Z" fill="#6d806c" />
      <path d="M34 23H56V26H54V29H37V26H34Z" fill="#a8b09a" />
      <path d="M35 18H39V14H44V17H49V13H54V18H58V21H33V18Z" fill="#9c704a" />
      <path d="M37 16H41V20H37ZM48 16H52V19H48ZM54 19H57V21H54Z" fill="#e0ad6d" />
      <path d="M36 29H42V34H36ZM49 29H55V34H49Z" fill="#172724" />
      <path d="M38 30H40V32H38ZM51 30H53V32H51Z" fill="#b7bea6" />
    </>}
    {mode === 'survey' && <>
      <path d="M6 7H39V33H6Z" fill="#182b27" />
      <path d="M8 5H41V31H8Z" fill="#8d7954" />
      <path d="M10 7H39V29H10Z" fill="#d4c79b" />
      <path d="M15 7V29H13V7ZM24 7V29H22V7ZM33 7V29H31V7ZM10 13H39V15H10ZM10 22H39V24H10Z" fill="#b7b48a" />
      <path d="M10 8H20V12H24V20H19V26H14V17H10Z" fill="#73846c" />
      <path d="M25 10H28V13H25ZM29 16H32V19H29ZM33 23H36V26H33Z" fill="#a2744d" />
      <path d="M38 12H53V15H58V30H53V34H38V30H34V16H38Z" fill="#1b302d" />
      <path d="M39 14H52V17H55V28H52V31H39V28H36V17H39Z" fill="#b3935e" />
      <path d="M40 17H50V19H52V27H49V29H41V27H39V20H40Z" fill="#d2d6b8" />
      <path d="M44 17H47V23H50V25H44Z" fill="#9e664b" />
      <path d="M44 24H47V29H44ZM40 22H44V25H40Z" fill="#526c60" />
      <path d="M46 21H48V24H46Z" fill="#f2d393" />
    </>}
    {mode === 'infrastructure' && <>
      <path d="M8 10H56V35H8Z" fill="#142723" />
      <path d="M9 9H15V35H9ZM48 9H54V35H48ZM7 6H56V12H7Z" fill="#9d7b4a" />
      <path d="M10 7H53V9H10ZM10 13H12V33H10ZM49 13H51V33H49Z" fill="#d0ae70" />
      <path d="M15 13H19V16H22V20H18V17H15ZM43 13H48V17H44V20H41V16H43Z" fill="#6a573b" />
      <path d="M27 9H31V15H27ZM23 15H35V18H23ZM24 18H34V27H24ZM23 27H35V30H23Z" fill="#8a8e70" />
      <path d="M27 18H31V27H27Z" fill="#f0cb7b" />
      <path d="M28 19H31V25H28Z" fill="#f8e9ae" />
      <path d="M0 33H64V36H0ZM7 35H11V40H7ZM24 35H28V40H24ZM41 35H45V40H41ZM58 35H62V40H58Z" fill="#8f7a55" />
      <path d="M0 33H64V35H0Z" fill="#b6b7a0" />
    </>}
  </svg>;
}

export function DeepClaimOperationPicker({ value, onChange, disabled = false, includeSupport = true }: DeepClaimOperationPickerProps) {
  const descriptionId = useId();
  const groups: { label: string; optional?: boolean; modes: DeepClaimMode[] }[] = [
    { label: 'Mining', modes: ['explore', 'extract'] },
    ...(includeSupport ? [{ label: 'Planning & improvements', optional: true, modes: ['survey', 'infrastructure'] as DeepClaimMode[] }] : []),
  ];

  return <div className="dcl-intent-picker" role="group" aria-label="Expedition type" data-dc-tutorial="dispatch-mode" data-selectable={value !== undefined}>
    {groups.map(group => <div className="dcl-intent-group" key={group.label} role="group" aria-label={group.label}>
      <div className="dcl-intent-heading"><span>{group.label}</span>{group.optional && <small>Optional</small>}</div>
      <div className="dcl-intent-options">{group.modes.map(mode => <button
        type="button"
        key={mode}
        className="dcl-intent-choice"
        data-dc-operation={mode}
        aria-label={CLAIM_OPERATION_NAMES[mode]}
        aria-describedby={`${descriptionId}-${mode}-payoff ${descriptionId}-${mode}-outcome`}
        aria-pressed={value === undefined ? undefined : value === mode}
        disabled={disabled}
        onClick={() => { if (value !== mode) onChange(mode); }}
      >
        <span className="dcl-intent-title-row"><span className="dcl-intent-art"><OperationArt mode={mode} /></span><strong>{CLAIM_OPERATION_NAMES[mode]}</strong></span>
        {value !== undefined && <span className="dcl-intent-check" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>}
        <span id={`${descriptionId}-${mode}-payoff`} className="dcl-intent-description">{CLAIM_OPERATION_COPY[mode].payoff}</span>
        <span id={`${descriptionId}-${mode}-outcome`} className="dcl-intent-outcome">{CLAIM_OPERATION_COPY[mode].outcome}</span>
      </button>)}</div>
    </div>)}
  </div>;
}
