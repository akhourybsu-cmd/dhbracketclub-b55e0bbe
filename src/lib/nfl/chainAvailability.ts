export function chainAvailabilityNote(market: {
  source_provider: string; subject_external_id: string | null;
  availability_status?: string; availability_checked_at?: string | null; availability_note?: string | null;
}, now = Date.now()) {
  if (market.source_provider !== 'espn-roster' || !market.subject_external_id) return null;
  if (market.availability_status !== 'verified') return market.availability_note?.replace(/new selections paused(?: until rechecked)?\.?/gi, 'selection allowed while checks continue.') || 'Availability recheck pending; you can still pick this player.';
  const checked = Date.parse(market.availability_checked_at || '');
  if (!Number.isFinite(checked) || now - checked > 24 * 60 * 60_000 || checked > now + 60_000) return 'Availability recheck pending; you can still pick this player.';
  return null;
}
