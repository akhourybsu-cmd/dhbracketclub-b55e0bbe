/** Presentation only. Canonical mode IDs and authoritative quotes stay unchanged. */
export const CLAIM_OPERATION_NAMES = {
  explore: 'Expand tunnels',
  extract: 'Mine a deposit',
  survey: 'Scout the area',
  infrastructure: 'Improve the mine',
} as const;

export const CLAIM_OPERATION_COPY = {
  explore: { payoff: 'Open passages into unknown ground.', outcome: 'New ground · Possible cargo' },
  extract: { payoff: 'Bring materials back from a known seam.', outcome: 'Materials from a known seam' },
  survey: { payoff: 'See nearby ground before digging.', outcome: 'Map only · No cargo' },
  infrastructure: { payoff: 'Build equipment for future shifts.', outcome: 'Helps future shifts nearby' },
} as const;

export const CLAIM_PROJECT_NAMES = { supports: 'Timber Supports', ventilation: 'Ventilation', pump: 'Drainage Pump', rail: 'Haul Rail' } as const;

export const CLAIM_PROJECT_BENEFITS = {
  supports: 'Fewer rockfall delays',
  ventilation: 'Fewer gas delays · Reduces deep heat',
  pump: 'Fewer water delays',
  rail: 'Less travel · More time working',
} as const;
