import { useId, useMemo } from 'react';
import { MAPS } from '@/lib/mesomon/data/maps';
import { rillikGangway } from '@/lib/mesomon/data/tideObstacles';
import { fieldObstaclesForMap } from '@/lib/mesomon/data/fieldObstacles';
import { getChartExits, getChartRoute } from '@/lib/mesomon/wayfinding';
import type { Direction, MesomonSaveV1, TileKind } from '@/lib/mesomon/types';
import { ChartLandmarks } from './ChartLandmarks';
import './locationChart.css';

const inks: Record<TileKind, string> = {
  water: '#739a99', 'dark-water': '#52797d', wall: '#8c8c76', roof: '#bc987a',
  floor: '#e1d1ad', wood: '#cbac7e', stone: '#d8ccab', grass: '#a7ae83',
  stairs: '#b8ae92', sand: '#e7d4a3', reeds: '#9aa783',
};
const bearings: Record<Direction, string> = { up: 'north', right: 'east', down: 'south', left: 'west' };
const arrows: Record<Direction, string> = { up: '↑', right: '→', down: '↓', left: '←' };
const angles: Record<Direction, number> = { up: 0, right: 90, down: 180, left: 270 };
const position = 'M0 -1.05L.72 .68 0 .37 -.72 .68Z';
const exit = 'M-.84 .86V-.26A.84 .84 0 0 1 .84-.26V.86H.34v-1a.34 .34 0 0 0-.68 0v1Z';
const stop = 'M0 .04l-.8-.96L0-1.84l.8.92Z';
const mapTextures: Partial<Record<TileKind, string>> = {
  water: 'water', 'dark-water': 'water', wall: 'hatch', wood: 'boards', reeds: 'reeds',
};

function ChartKey({ symbol, label }: { symbol: 'position' | 'exit' | 'stop'; label: string }) {
  return <span>
    <svg aria-hidden="true" viewBox="-1.25 -1.25 2.5 2.5" width="14" height="14">
      <path d={symbol === 'position' ? position : symbol === 'exit' ? exit : stop}
        transform={symbol === 'stop' ? 'translate(0 .88)' : undefined} className={'meso-chart-' + symbol} />
    </svg>
    {label}
  </span>;
}

export function LocationChart({ save }: { save: MesomonSaveV1 }) {
  const id = useId();
  const map = MAPS[save.player.mapId];
  const obstacles = fieldObstaclesForMap(map.id);
  const route = useMemo(() => getChartRoute(save), [save]);
  const exits = getChartExits(save);
  const otherExits = exits.filter(door => door.id !== route?.target.id);
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
  // Give symbols a similar printed size on the small room plans and the full town survey.
  const scale = map.width / 30;
  const { x, y, facing } = save.player;
  return <section className="meso-location-chart" aria-label="Location chart">
    <div className="meso-chart-heading">
      <h2>{map.name}</h2>
      <span className="meso-chart-north" aria-hidden="true">↑ N</span>
    </div>
    <div className="meso-chart-frame">
      <svg className="meso-chart-map" viewBox={`0 0 ${map.width} ${map.height}`} role="img" aria-labelledby={id + '-title'} aria-describedby={id + '-description'}>
        <title id={id + '-title'}>{map.name + ' walking chart'}</title>
        <desc id={id + '-description'}>
          {[`You are facing ${bearings[facing]}.`, route && `Next stop: ${route.label}.`,
            exits.length > 0 && `Open exits: ${exits.map(door => door.label).join(', ')}.`,
            obstacles.length > 0 && 'Hatched footprints mark solid scenery.'].filter(Boolean).join(' ')}
        </desc>
        <defs>
          <pattern id={id + '-water'} patternUnits="userSpaceOnUse" width="2.9" height="2.1">
            <path d="M.18 .63q.32.13.64 0t.58 0m.55 1.02q.24.1.52 0" fill="none" stroke="#d1e2c7" strokeOpacity=".42" strokeWidth=".13" />
          </pattern>
          <pattern id={id + '-hatch'} patternUnits="userSpaceOnUse" width="1.1" height="1.1">
            <path d="M0 1.1l1.1-1.1" stroke="#4c554d" strokeOpacity=".28" strokeWidth=".13" />
          </pattern>
          <pattern id={id + '-boards'} patternUnits="userSpaceOnUse" width="3.4" height="1.45">
            <path d="M0 .7h3.4m-2.9 0v.72m1.6-1.4V.7" stroke="#8c7054" strokeOpacity=".36" strokeWidth=".11" />
          </pattern>
          <pattern id={id + '-obstacle'} patternUnits="userSpaceOnUse" width=".66" height=".66">
            <rect width=".66" height=".66" fill="#9e8c70" />
            <path d="M-.17 .17l.34-.34M0 .66l.66-.66m-.17 .83.34-.34" stroke="#615b48" strokeWidth=".12" />
          </pattern>
          <pattern id={id + '-reeds'} patternUnits="userSpaceOnUse" width="1.6" height="1.5">
            <path d="M.42 .98.18.46m.24.52.08-.74m-.08.74.3-.46" fill="none" stroke="#4e6756" strokeWidth=".12" />
          </pattern>
        </defs>
        {terrain.map(({ kind, d }) => <g key={kind}>
          <path d={d} fill={inks[kind]} shapeRendering="crispEdges" />
          {mapTextures[kind] && <path d={d} fill={`url(#${id}-${mapTextures[kind]})`} />}
        </g>)}
        <g aria-hidden="true" fill={`url(#${id}-obstacle)`} stroke="#554f3f" strokeWidth=".12">
          {obstacles.map(({ id: name, x, y, width, height }) =>
            <rect key={name} data-obstacle={name} x={x} y={y} width={width} height={height} />)}
        </g>
        {map.id === 'tide-stairs' && save.questFlags.gate_opened !== true && <rect
          x={rillikGangway.x} y={rillikGangway.y} width="1" height="1" fill={inks['dark-water']}
          stroke="#554f3f" strokeWidth=".12" data-crossing="raised-gangway" />}
        <ChartLandmarks zone={map.id} flooded={save.questFlags.sluice_open !== true} />
        {otherExits.map(door => <path key={door.id} aria-hidden="true" data-exit={door.id} d={exit}
          transform={`translate(${door.x + .5} ${door.y + .5}) scale(${scale})`} className="meso-chart-exit"><title>{door.label}</title></path>)}
        {line && <g fill="none" strokeLinejoin="round" strokeLinecap="round">
          <polyline points={line} stroke="#fff5d9" vectorEffect="non-scaling-stroke" strokeWidth="4.2" />
          <polyline points={line} stroke="#853d30" vectorEffect="non-scaling-stroke" strokeWidth="2.15" strokeDasharray="4.2 3" />
        </g>}
        {route && <g transform={`translate(${route.target.x + .5} ${route.target.y + .5}) scale(${scale})`}>
          <path d={stop} className="meso-chart-stop" />
          <circle cx="0" cy="-.91" r=".19" fill="#fff5d9" />
        </g>}
        <path d={position} className="meso-chart-position" transform={`translate(${x + .5} ${y + .5}) scale(${scale}) rotate(${angles[facing]})`} />
      </svg>
    </div>
    <div className="meso-chart-key">
      <ChartKey symbol="position" label="Your position" />
      {route && <ChartKey symbol="stop" label="Next stop" />}
      {otherExits.length > 0 && <ChartKey symbol="exit" label="Open exit" />}
      {obstacles.length > 0 && <span><svg aria-hidden="true" viewBox="0 0 2.5 2.5" width="14" height="14">
        <rect x=".15" y=".45" width="2.2" height="1.6" fill={`url(#${id}-obstacle)`} stroke="#554f3f" strokeWidth=".2" />
      </svg>Solid scenery</span>}
    </div>
    {route ? <>
      <h3>{route.label}</h3>
      <ol className="meso-chart-directions" role="list" aria-label="Walking directions">
        {route.legs.map(({ direction, steps }, i) => <li key={i}><span aria-hidden="true">{arrows[direction]}</span> {steps} {steps === 1 ? 'step' : 'steps'} {bearings[direction]}</li>)}
        <li>{route.facing ? `Face ${bearings[route.facing]} and press A.` : 'Press A here.'}</li>
      </ol>
    </> : <p>{save.questFlags.chapter_complete ? 'The chapter is complete. You can explore the harbor at your own pace.' : 'There is no walking route from this spot.'}</p>}
  </section>;
}
