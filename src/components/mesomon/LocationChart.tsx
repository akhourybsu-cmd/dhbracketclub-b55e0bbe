import { useMemo } from 'react';
import { MAPS } from '@/lib/mesomon/data/maps';
import { getChartRoute } from '@/lib/mesomon/wayfinding';
import type { Direction, MesomonSaveV1, TileKind } from '@/lib/mesomon/types';
import './locationChart.css';

const inks: Record<TileKind, string> = {
  water: '#649499', 'dark-water': '#537b82', wall: '#898877', roof: '#a28473',
  floor: '#dfcda4', wood: '#c9a775', stone: '#d8ccac', grass: '#9aaa80',
  stairs: '#c0b591', sand: '#e8d4a3', reeds: '#99ad88',
};
const bearings: Record<Direction, string> = { up: 'north', right: 'east', down: 'south', left: 'west' };
const arrows: Record<Direction, string> = { up: '↑', right: '→', down: '↓', left: '←' };

/** Regional terrain alone is charted. Story locations appear only when they are the next stop. */
export function LocationChart({ save }: { save: MesomonSaveV1 }) {
  const map = MAPS[save.player.mapId];
  const route = useMemo(() => getChartRoute(save), [save]);
  const terrain = useMemo(() => {
    const paths = new Map<TileKind, string[]>();
    for (const [y, row] of map.tiles.entries()) {
      for (let x = 0; x < row.length;) {
        const kind = row[x];
        let end = x + 1;
        while (row[end] === kind) end++;
        const commands = paths.get(kind) ?? [];
        commands.push(`M${x} ${y}h${end - x}v1H${x}z`);
        paths.set(kind, commands);
        x = end;
      }
    }
    return Array.from(paths, ([kind, path]) => ({ kind, d: path.join(' ') }));
  }, [map]);
  const line = route?.points.map(({ x, y }) => `${x + .5},${y + .5}`).join(' ');
  return <section className="meso-location-chart" aria-label="Location chart">
    <h2>{map.name}</h2>
    <div className="meso-chart-frame">
      <svg className="meso-chart-map" viewBox={`0 0 ${map.width} ${map.height}`} aria-hidden="true">
        {terrain.map(({ kind, d }) => <path key={kind} d={d} fill={inks[kind]} shapeRendering="crispEdges" />)}
        {line && <g fill="none" strokeLinejoin="round" strokeLinecap="round">
          <polyline points={line} stroke="#fff5d9" strokeWidth=".65" />
          <polyline points={line} stroke="#723327" strokeWidth=".31" strokeDasharray=".48 .33" />
        </g>}
        {route && <path transform={`translate(${route.target.x + .5} ${route.target.y + .5})`} d="M0 -0.8 L0.8 0 0 0.8 -0.8 0Z" fill="#a34731" stroke="#fff5d9" strokeWidth=".18" />}
        <circle cx={save.player.x + .5} cy={save.player.y + .5} r=".54" fill="#173e4a" stroke="#fff5d9" strokeWidth=".2" />
      </svg>
      <span className="meso-chart-north" aria-hidden="true">↑ N</span>
    </div>
    <div className="meso-chart-key"><span><b aria-hidden="true">●</b> Your position</span>{route && <span><b aria-hidden="true">◆</b> Next stop</span>}</div>
    {route ? <>
      <h3>{route.label}</h3>
      <ol className="meso-chart-directions" role="list" aria-label="Walking directions">
        {route.legs.map(({ direction, steps }, i) => <li key={i}><span aria-hidden="true">{arrows[direction]}</span> {steps} {steps === 1 ? 'step' : 'steps'} {bearings[direction]}</li>)}
        <li>{route.facing ? `Face ${bearings[route.facing]} and press A.` : 'Press A here.'}</li>
      </ol>
    </> : <p>{save.questFlags.chapter_complete ? 'The chapter is complete. You can explore the harbor at your own pace.' : 'There is no walking route from this spot.'}</p>}
  </section>;
}
