// Explicitly synthetic PUBLIC visual geometry for browser renderer budgets.
// This route exists only in the local QA entry. It has no economic controls,
// transport mutations, hidden seed, private plan or authoritative world writes.
import { useMemo, useState } from 'react';
import { DeepClaimCanvas } from '../../src/components/deepClaim/renderer/DeepClaimCanvas';
import type { DeepClaimSnapshot, DeepClaimTile } from '../../src/lib/deepClaim/types';

export function DeepClaimRuntimeVisual() {
  const source = (window as Window & { deepClaimRuntimeSnapshot?: DeepClaimSnapshot }).deepClaimRuntimeSnapshot;
  const [mode, setMode] = useState<'normal' | 'reduced' | 'static'>('normal');
  const [focus, setFocus] = useState(0);
  const snapshot = useMemo(() => {
    if (!source?.world) return null;
    const tiles: DeepClaimTile[] = [];
    for (let y = 1; y <= 599; y++) for (let x = 0; x < 96; x++) {
      const cleared = (x + y) % 3 === 0;
      tiles.push({ x, y, material: cleared ? null : (x + y) % 2 ? 'stone' : 'coal',
        remaining: cleared ? 0 : 12, initial_amount: cleared ? 0 : 12,
        terrain: cleared ? 'excavated' : 'stone', formation: cleared && y % 11 < 4 ? 'cavern' : null });
    }
    return { ...source, world: { ...source.world, max_depth: 599, tiles },
      infrastructure: [], discoveries: [], field_reports: [] } as DeepClaimSnapshot;
  }, [source]);
  if (!snapshot) return <main><h1>Public renderer fixture requires an actual founded snapshot</h1></main>;
  return <main className="deep-claim" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
    <header style={{ flex: '0 0 auto' }}><h1 style={{ fontSize: 16 }}>Synthetic public renderer geometry</h1><p style={{ fontSize: 12 }}>57,504 authored test cells. No company terrain or resources are changed.</p></header>
    <div role="group" aria-label="Renderer fixture mode" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {(['normal', 'reduced', 'static'] as const).map(value => <button type="button" className="dcl-button" aria-pressed={mode === value} key={value} onClick={() => setMode(value)}>{value} rendering</button>)}
      <button type="button" className="dcl-button" onClick={() => setFocus(value => value + 1)}>Locate synthetic deep view</button>
    </div>
    <div style={{ flex: '1 1 auto', minHeight: 0, position: 'relative' }}>
      <DeepClaimCanvas snapshot={snapshot} view="mine" selectedTile={null} onSelectTile={() => {}} onSelectBuilding={() => {}}
        reducedMotion={mode === 'static'} reducedGraphics={mode === 'reduced'}
        focusRequest={{ id: `synthetic-${focus}`, point: { x: 48, y: focus % 2 ? 580 : 290 }, scale: 12 }} />
    </div>
  </main>;
}
