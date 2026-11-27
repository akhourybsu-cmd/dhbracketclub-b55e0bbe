import type { MapId } from '@/lib/mesomon/types';

/** Survey marks sit below the bearings and use the field's logical tile coordinates. */
export function ChartLandmarks({ zone, flooded }: { zone: MapId; flooded: boolean }) {
  switch (zone) {
    case 'ship':
      return <g className="meso-chart-engraving" data-survey="ship">
        {/* The stepped bow, deckhouses, compass and stern gangplank. */}
        <path d="M3.35 9.7V2.5L5.9 1.9H10L12.65 2.5V9.7Q12.65 12.15 8 12.45Q3.35 12.15 3.35 9.7Z" />
        <path d="M3.65 3.4L5.5 2.9H10.65L12.4 3.4M4.1 5.5h2.8m2.3 0h2.8M4.2 4.1h2.5m2.6 0h2.5M5.45 3.3v1.95m5.05-1.95v1.95" />
        <path d="M7.4 11.5v1.15h1.9V11.5m-1.8.45h1.65" />
        <path d="M8.35 6.9l.3.57.75.22-.75.24-.3.58-.25-.58-.72-.24.72-.22Z" />
      </g>;
    case 'harbor':
      return <g className="meso-chart-engraving" data-survey="harbor">
        {/* House ridges, the folded market awning, weighbridge and pier piles. */}
        <path d="M4.35 6.35h9.3v6.3h-9.3Zm0 0L6.3 8.6h5.4l1.95-2.25m-9.3 6.3L6.3 8.6m5.4 0 1.95 4.05M8.2 13.25h2.45v1.1H8.2Z" />
        <path d="M19.35 7.4h9.3v5.1h-9.3Zm0 0 1.65 1.8h6l1.65-1.8M18.3 13h11.4l-.65 1.2h-10.1Zm2.1.1-.25 1m2.2-1-.1 1m2.4-1 .1 1m2.15-1 .25 1" />
        <path d="M3.6 26.4v4.8h3.8v-4.8m2.2.05v2.15H24.4v5h4.2v-7.15m-17.65.6h3.2m2 .9h3.8m5.3 3.6h2.5M32.4 20h4.1m-4.1 1.1h4.1m-4.1 1.1h4.1" />
        <path d="M5.2 18.3h2.6v2.1H5.2zm8 1.1h2.6v1h-2.6zm12.2 0H28v1h-2.6z" />
      </g>;
    case 'workshop':
      return <g className="meso-chart-engraving" data-survey="workshop">
        {/* Benches with rolled charts and the indigo rug in the reading corner. */}
        <path d="M2.15 2.15h11.7v10.55H9.55m-2.6 0h-4.8ZM2.9 3.1h3.05v1.8H2.9Zm7.1 0h3.05v1.8H10Z" />
        <path d="M3.35 3.55h.8v.65h-.8zm1.1.65.45-.3.45.12.33-.47m4.74.15.8.17.6-.35.55.21M6.5 8.2h3.3v2.1H6.5zM7 8.7h2.3v1.1H7zM3.28 8.4h1.98v1.75H3.28zM12.15 8.6v1.75" />
      </g>;
    case 'tide-stairs':
      return <g className="meso-chart-engraving" data-survey="tide-stairs">
        <path d="M3.4 2.5h13v11.75H10.2m-2.5 1.4H4.2V14M7.2 4.25h4.55v5.4H7.2zM7.2 5.2h4.55m-4.55 1.05h4.55M7.2 7.3h4.55M7.2 8.35h4.55" />
        <circle cx="8.5" cy="8.5" r=".63" fill="#d9c090" />
        <path d="M7.95 8.5h1.1m-.55-.55v1.1m-.4-.95.8.8m-3.95 4.9 1.45-.2m3.8-3.3h5.5v3.5h-5.5z" />
      </g>;
    case 'passage':
      return <g className="meso-chart-engraving" data-survey="passage">
        <path d="M2.25 20.4v-9.85h4.4m.7-.3v-4h2.3v4.85h4.55m.97-.3V3.35h5.4v11.2H12m-2.12 0H7.12m-.48.65v5.25" />
        <path d="M7.7 6.75h1.45m7.35-2.55v5.5m1.15-5.5v3M3.4 17.6h2.3v.6H3.4z" />
        {flooded
          ? <g data-crossing="flooded"><path d="M10 11h2v4h-2z" fill="#477279" /><path d="M10.15 12.15l.4.12.65-.2m-.95 1.88.55-.12.8.1" stroke="#b2c4b4" /></g>
          : <path data-crossing="drained" d="M10 11.25h2m-2 .8h2m-2 .8h2m-2 .8h2m-2 .8h2" />}
      </g>;
    case 'chamber':
      return <g className="meso-chart-engraving" data-survey="chamber">
        {/* Sunken balancing tanks surround the tidal dial; leave the tongue open. */}
        <path d="M3.05 3.08h2.95v2.84H3.05zm9.05 5.02h2.8v3.8h-2.8zM3.25 3.6h2.5m6.7 5.15h2.05m-2.05 2.4h2.05" />
        <path d="M8.9 7.1C6.5 6.9 6.25 5.55 7 4.5c.85-1.2 3.4-1.42 4.83-.14 1.06.96.82 2.28-1.68 2.76m-1.24.5v3.8H7m3.1-3.8v2.1h1.48l.45-.55" />
        <path d="M8.65 12.15l.55-.5.55.5-.55.48z" />
      </g>;
  }
}
