import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CreateDraftPage from '@/pages/CreateDraftPage';
import { DEFAULT_LIVE_SETTINGS } from '@/lib/draft/liveDraft';

const wire = vi.hoisted(() => ({
  liveEnabled: true,
  flagLoading: false,
  competition: vi.fn(),
  draft: vi.fn(),
  writes: [] as { table: string; payload: Record<string, unknown> }[],
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'host-1' } }) }));
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
  wire.writes = [];
  wire.competition.mockResolvedValue({ data: { id: 'competition-1' }, error: null });
  wire.draft.mockResolvedValue({ data: { id: 'draft-1' }, error: null });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Dedicated Draft Arena LIVE creation', () => {
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
