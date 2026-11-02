export type ClaimNavKind = 'surface' | 'mine' | 'crew' | 'stores' | 'log' | 'settings';

/** Original, tiny industrial emblems. Labels live on the surrounding controls. */
export function DeepClaimNavEmblem({ kind }: { kind: ClaimNavKind }) {
  const ink = '#253b35', shade = '#758a76', metal = '#e0c17d', light = '#f4e3b4';
  return <svg className="dcl-nav-emblem" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
    {kind === 'surface' && <><path d="M2 20V10H5V7H9V4H15V7H19V10H22V20Z" fill={ink} /><path d="M4 11H20V19H4ZM9 6H15V9H9Z" fill={shade} /><path d="M7 12H11V15H7ZM14 12H18V15H14ZM10 16H14V21H10Z" fill={metal} /><path d="M3 9H21V11H3ZM1 20H23V22H1Z" fill={light} /></>}
    {kind === 'mine' && <><path d="M3 6H9V3H17V5H20V8H22V11H18V8H15V6H11L5 10Z" fill={light} /><path d="M13 6H17V10H13Z" fill={shade} /><path d="M14 8H18V12H14V16H10V20H6V23H3V19H6V15H10V11H14Z" fill={metal} /><path d="M3 5H9V7H5V10H2V7Z" fill={shade} /></>}
    {kind === 'crew' && <><path d="M2 23V17H5V15H9V13H15V15H19V17H22V23Z" fill={shade} /><path d="M7 7H17V14H14V16H10V14H7Z" fill="#cda87b" /><path d="M5 6H7V3H17V6H19V9H5Z" fill={metal} /><path d="M10 2H14V7H10Z" fill={light} /><path d="M8 10H10V12H8ZM14 10H16V12H14ZM6 17H9V23H6ZM15 17H18V23H15Z" fill={ink} /></>}
    {kind === 'stores' && <><path d="M2 5H22V22H2Z" fill={ink} /><path d="M4 7H20V20H4Z" fill="#98774e" /><path d="M4 3H20V6H4ZM3 10H21V13H3ZM5 7H7V21H5ZM17 7H19V21H17Z" fill={metal} /><path d="M8 14H16V18H8Z" fill={light} /><path d="M10 15H14V17H10Z" fill={shade} /></>}
    {kind === 'log' && <><path d="M4 2H19V22H4Z" fill={ink} /><path d="M6 3H18V21H6Z" fill={metal} /><path d="M3 4H6V21H3ZM8 2H10V22H8Z" fill={shade} /><path d="M12 6H17V8H12ZM12 11H17V13H12ZM12 16H16V18H12Z" fill={ink} /><path d="M18 4H20V20H18Z" fill={light} /></>}
    {kind === 'settings' && <><path d="M10 1H14V5H18V7H22V11H19V15H21V19H17V21H13V23H9V20H5V18H2V14H5V10H2V6H7V4H10Z" fill={shade} /><path d="M9 7H15V9H17V15H15V17H9V15H7V9H9Z" fill={metal} /><path d="M10 10H14V14H10Z" fill={ink} /><path d="M10 2H14V4H10ZM3 7H6V9H3ZM18 17H21V19H18Z" fill={light} /></>}
  </svg>;
}
