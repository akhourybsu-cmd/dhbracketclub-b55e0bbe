import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CreateDraftPage from '@/pages/CreateDraftPage';
import { DEFAULT_LIVE_SETTINGS } from '@/lib/draft/liveDraft';
import type { CommissionerPlan, CommissionerPreset, CommissionerPresetConfig } from '@/lib/draft/commissioner';

const wire = vi.hoisted(() => ({
  liveEnabled: true,
  flagLoading: false,
  clubId: null as string | null,
  presets: vi.fn(),
  plan: vi.fn(),
  competition: vi.fn(),
  draft: vi.fn(),
  writes: [] as { table: string; payload: Record<string, unknown> }[],
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'host-1' } }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: wire.clubId ? { id: wire.clubId } : null }) }));
vi.mock('@/lib/draft/commissioner', () => ({ fetchCommissionerPresets: (...args: unknown[]) => wire.presets(...args), fetchCommissionerPlan: (...args: unknown[]) => wire.plan(...args) }));
vi.mock('@/hooks/useFeatureFlags', () => ({ useFeatureFlag: () => ({ enabled: wire.liveEnabled, loading: wire.flagLoading }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('framer-motion', async () => ({ ...await vi.importActual<typeof import('framer-motion')>('framer-motion'), useReducedMotion: () => true }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (table: string) => ({ insert: (payload: Record<string, unknown>) => {
    wire.writes.push({ table, payload });
    if (table === 'competitions') return { select: () => ({ single: wire.competition }) };
    if (table === 'drafts') return { select: () => ({ single: wire.draft }) };
    return Promise.resolve({ error: null });
  } }) },
}));

function Destination() {
  const location = useLocation();
  return <p data-testid="created-route">{location.pathname}</p>;
}
function Harness({ route = '/drafts/live/create' }: { route?: string }) {
  return <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes>
    <Route path="/drafts/live/create" element={<CreateDraftPage />} />
    <Route path="/drafts/create" element={<CreateDraftPage />} />
    <Route path="/drafts/live/:draftId" element={<Destination />} />
    <Route path="/drafts/:draftId" element={<Destination />} />
  </Routes></MemoryRouter>;
}
const enterTopic = () => fireEvent.change(screen.getByLabelText('Topic'), { target: { value: '  Best film villains  ' } });
const step = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }));
const draftPayload = () => wire.writes.find((write) => write.table === 'drafts')?.payload;

beforeEach(() => {
  wire.liveEnabled = true;
  wire.flagLoading = false;
  wire.clubId = null;
  wire.writes = [];
  wire.competition.mockResolvedValue({ data: { id: 'competition-1' }, error: null });
  wire.draft.mockResolvedValue({ data: { id: 'draft-1' }, error: null });
  wire.presets.mockResolvedValue([]);
  wire.plan.mockResolvedValue(null);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Dedicated Draft Arena LIVE creation', () => {
  it('keeps existing creation defaults for a persisted preset with omitted optional settings', async () => {
    wire.clubId = 'club-1';
    wire.presets.mockResolvedValueOnce([{ id: 'preset-default', club_id: 'club-1', season_id: 'season-1', name: 'Original defaults', config: {} as CommissionerPresetConfig, version: 1, created_by: 'host-1', updated_by: 'host-1', created_at: '', updated_at: '' }]);
    render(<Harness route="/drafts/create?preset=preset-default&season=season-1" />);
    enterTopic();
    fireEvent.click(await screen.findByRole('button', { name: 'Apply saved preset' }));
    step('Review');
    fireEvent.click(screen.getByRole('button', { name: 'Create Draft' }));
    await waitFor(() => expect(screen.getByTestId('created-route')).toBeVisible());
    expect(draftPayload()).toEqual({ competition_id: 'competition-1', topic: 'Best film villains', created_by: 'host-1', num_rounds: 5, status: 'setup', ai_context: null });
  });

  it('loads a persisted preset without resetting inputs and applies every existing LIVE setting only on request', async () => {
    wire.clubId = 'club-1';
    let complete!: (rows: CommissionerPreset[]) => void;
    wire.presets.mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }));
    const config = { topic: 'Template topic', description: 'Template description', num_rounds: 8, ai_context: 'Use the original topic scope.', is_live: true, live_settings: { ...DEFAULT_LIVE_SETTINGS, pickSeconds: 75, timeoutBehavior: 'auto_skip' as const, sound: false, autoStartClock: false, reportBroadcast: false } };
    const preset: CommissionerPreset = { id: 'preset-1', club_id: 'club-1', season_id: 'season-1', name: 'Club show', config, version: 1, created_by: 'host-1', updated_by: 'host-1', created_at: '', updated_at: '' };
    render(<Harness route="/drafts/live/create?preset=preset-1&season=season-1" />);
    enterTopic();
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'Keep my description' } });
    await act(async () => complete([preset]));
    expect(wire.presets).toHaveBeenCalledWith('club-1', 'season-1');
    step('Rules');
    expect(screen.getByRole('button', { name: '5' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('AI Judging Context')).toHaveValue('');
    step('Topic');
    expect(screen.getByLabelText('Topic')).toHaveValue('  Best film villains  ');
    fireEvent.click(screen.getByRole('button', { name: 'Apply saved preset' }));
    expect(screen.getByText(/Started from Club show/)).toBeVisible();
    expect(screen.getByLabelText('Topic')).toHaveValue('  Best film villains  ');
    expect(screen.getByLabelText(/Description/)).toHaveValue('Keep my description');
    step('Rules');
    expect(screen.getByRole('button', { name: '8' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('AI Judging Context')).toHaveValue(config.ai_context);
    step('Stage');
    expect(screen.getByRole('button', { name: '75s' })).toHaveAttribute('aria-pressed', 'true');
    step('Review');
    fireEvent.click(screen.getByRole('button', { name: 'Create live event' }));
    await waitFor(() => expect(screen.getByTestId('created-route')).toBeVisible());
    expect(draftPayload()).toMatchObject({ num_rounds: 8, ai_context: config.ai_context, is_live: true, timer_seconds: 75, live_settings: config.live_settings });
    expect(wire.writes[0].payload.description).toBe('Keep my description');
  });

  it('uses a persisted plan in a new draft while leaving the plan link as an explicit later commissioner action', async () => {
    wire.clubId = 'club-1';
    const plan: CommissionerPlan = { id: 'plan-1', club_id: 'club-1', season_id: 'season-1', topic: 'Planned book heroes', notes: 'Private planning notes are not a public description', ai_context: 'Include all books.', num_rounds: 7, is_live: false, live_settings: {}, scheduled_at: '2026-11-06T18:00:00Z', due_at: null, status: 'ready', preset_id: null, draft_id: null, version: 3, created_by: 'host-1', updated_by: 'host-1', created_at: '', updated_at: '' };
    wire.plan.mockResolvedValueOnce(plan);
    render(<Harness route="/drafts/create?plan=plan-1&season=season-1" />);
    expect(await screen.findByRole('button', { name: 'Apply planned draft' })).toBeEnabled();
    expect(screen.getByLabelText('Topic')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Apply planned draft' }));
    expect(wire.plan).toHaveBeenCalledWith('club-1', 'season-1', 'plan-1');
    expect(screen.getByLabelText('Topic')).toHaveValue(plan.topic);
    expect(screen.getByLabelText(/Description/)).toHaveValue('');
    step('Review');
    expect(screen.getByText(/After creation, add the draft/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Create Draft' }));
    await waitFor(() => expect(screen.getByTestId('created-route')).toBeVisible());
    expect(draftPayload()).toEqual({ competition_id: 'competition-1', topic: plan.topic, created_by: 'host-1', num_rounds: 7, status: 'setup', ai_context: plan.ai_context });
    expect(wire.writes.map((write) => write.table)).toEqual(['competitions', 'drafts', 'draft_participants', 'activity_feed']);
  });

  it('keeps LIVE fixed, preserves choices across stages and creates a setup event before entering its greenroom', async () => {
    render(<Harness />);
    expect(screen.getByRole('heading', { name: 'Draft Arena LIVE' })).toBeVisible();
    expect(screen.getByLabelText('LIVE event')).toBeVisible();
    for (const label of ['Topic', 'Rules', 'Stage', 'Review']) expect(screen.getByRole('button', { name: label })).toBeVisible();
    enterTopic();
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: '  Any storytelling medium  ' } });
    step('Rules');
    fireEvent.click(screen.getByRole('button', { name: '7' }));
    fireEvent.change(screen.getByLabelText('AI Judging Context'), { target: { value: '  Include every medium without narrowing the topic.  ' } });
    step('Stage');
    expect(screen.getByRole('button', { name: '90s' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '45s' }));
    fireEvent.click(screen.getByRole('button', { name: 'Auto-skip the pick' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Presentation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Projector sound effects' }));
    step('Rules');
    expect(screen.getByRole('button', { name: '7' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('AI Judging Context')).toHaveValue('  Include every medium without narrowing the topic.  ');
    step('Stage');
    expect(screen.getByRole('button', { name: 'Projector sound effects' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('tab', { name: 'Clock' }));
    expect(screen.getByRole('button', { name: '45s' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /^Live draft/ })).toBeNull();
    step('Review');
    fireEvent.click(screen.getByRole('button', { name: 'Create live event' }));
    await waitFor(() => expect(screen.getByTestId('created-route')).toHaveTextContent('/drafts/live/draft-1'));
    expect(draftPayload()).toEqual({
      competition_id: 'competition-1', topic: 'Best film villains', created_by: 'host-1', num_rounds: 7, status: 'setup',
      ai_context: 'Include every medium without narrowing the topic.', is_live: true, kiosk_code: expect.stringMatching(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/),
      timer_seconds: 45,
      live_settings: { ...DEFAULT_LIVE_SETTINGS, pickSeconds: 45, timeoutBehavior: 'auto_skip', sound: false },
      ceremony_enabled: true,
    });
    expect(wire.writes.map((write) => write.table)).toEqual(['competitions', 'drafts', 'draft_participants', 'activity_feed']);
    expect(wire.writes[0].payload.description).toBe('Any storytelling medium');
    expect(wire.writes[2].payload).toEqual({ draft_id: 'draft-1', user_id: 'host-1', pick_order: 1 });
  });

  it.each([
    { loading: true, message: 'Checking LIVE access…' },
    { loading: false, message: 'Live hosting is not available for this account.' },
  ])('never silently creates a normal draft while LIVE access is unavailable ($message)', async ({ loading, message }) => {
    wire.liveEnabled = false;
    wire.flagLoading = loading;
    const view = render(<Harness />);
    enterTopic();
    step('Review');
    expect(screen.getByRole('button', { name: 'Create live event' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(message);
    fireEvent.submit(screen.getByRole('form', { name: 'Create live event' }));
    expect(wire.writes).toHaveLength(0);
    wire.flagLoading = false;
    wire.liveEnabled = true;
    view.rerender(<Harness />);
    expect(screen.getByText('Best film villains')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Create live event' }));
    await waitFor(() => expect(screen.getByTestId('created-route')).toBeVisible());
    expect(draftPayload()?.is_live).toBe(true);
    expect(draftPayload()?.live_settings).toEqual(DEFAULT_LIVE_SETTINGS);
  });

  it('guards duplicate form submissions while the same creation request is pending', async () => {
    let complete!: (value: { data: { id: string }; error: null }) => void;
    wire.competition.mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }));
    render(<Harness />);
    enterTopic();
    step('Review');
    const form = screen.getByRole('form', { name: 'Create live event' });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(wire.writes.filter((write) => write.table === 'competitions')).toHaveLength(1);
    await act(async () => complete({ data: { id: 'competition-1' }, error: null }));
    await waitFor(() => expect(screen.getByTestId('created-route')).toBeVisible());
    expect(wire.writes.filter((write) => write.table === 'drafts')).toHaveLength(1);
  });

  it('retains the normal four-step creator and its original non-live payload/navigation', async () => {
    wire.liveEnabled = false;
    render(<Harness route="/drafts/create" />);
    expect(screen.getByRole('heading', { name: 'Create Draft' })).toBeVisible();
    for (const label of ['Basics', 'Judging', 'Format', 'Review']) expect(screen.getByRole('button', { name: label })).toBeVisible();
    enterTopic();
    step('Judging');
    fireEvent.change(screen.getByLabelText('AI Judging Context'), { target: { value: 'Original judging context' } });
    step('Format');
    fireEvent.click(screen.getByRole('button', { name: '10' }));
    step('Review');
    fireEvent.click(screen.getByRole('button', { name: 'Create Draft' }));
    await waitFor(() => expect(screen.getByTestId('created-route')).toHaveTextContent('/drafts/draft-1'));
    expect(draftPayload()).toEqual({ competition_id: 'competition-1', topic: 'Best film villains', created_by: 'host-1', num_rounds: 10, status: 'setup', ai_context: 'Original judging context' });
  });

  it('preserves the legacy live toggle and lets an unavailable LIVE choice be explicitly turned off without discarding inputs', async () => {
    const view = render(<Harness route="/drafts/create" />);
    enterTopic();
    step('Format');
    fireEvent.click(screen.getByRole('button', { name: /^Live draft/ }));
    wire.liveEnabled = false;
    view.rerender(<Harness route="/drafts/create" />);
    step('Review');
    expect(screen.getByRole('button', { name: 'Create Draft' })).toBeDisabled();
    expect(wire.writes).toHaveLength(0);
    step('Format');
    fireEvent.click(screen.getByRole('button', { name: /^Live draft/ }));
    step('Review');
    fireEvent.click(screen.getByRole('button', { name: 'Create Draft' }));
    await waitFor(() => expect(screen.getByTestId('created-route')).toHaveTextContent('/drafts/draft-1'));
    expect(draftPayload()?.topic).toBe('Best film villains');
    expect(draftPayload()?.is_live).toBeUndefined();
  });
});
