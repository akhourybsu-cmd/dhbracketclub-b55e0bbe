import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommissionerPlanner } from '@/components/draft/commissioner/CommissionerPlanner';
import { DEFAULT_LIVE_SETTINGS } from '@/lib/draft/liveDraft';
import type { CommissionerMutate, CommissionerPlan, CommissionerPreset, CommissionerWorkspaceData } from '@/lib/draft/commissioner';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'manager' } }) }));
const plan: CommissionerPlan = { id: 'plan-1', season_id: 'season-1', club_id: 'club-1', topic: 'Film classics', notes: 'A planned event', ai_context: 'Keep the original topic scope.', num_rounds: 5, is_live: false, live_settings: {}, scheduled_at: null, due_at: null, draft_id: null, preset_id: null, status: 'planned', version: 4, created_by: 'manager', updated_by: 'manager', created_at: '', updated_at: '' };
type Data = Pick<CommissionerWorkspaceData, 'plans' | 'presets' | 'reminders'> & Partial<Pick<CommissionerWorkspaceData, 'drafts'>>;
const empty: Data = { plans: [], presets: [], reminders: [] };
const result = { ok: true as const, record: null, audit_id: 'audit-1' };
function Harness({ data = empty, mutate, seasonId = 'season-1' }: { data?: Data; mutate: CommissionerMutate; seasonId?: string }) {
  return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><CommissionerPlanner clubId="club-1" seasonId={seasonId} data={data} mutate={mutate} recipients={[{ userId: 'player-1', name: 'Alex' }]} /></MemoryRouter>;
}
function fillPlan() {
  fireEvent.click(screen.getByRole('button', { name: 'New plan' }));
  fireEvent.change(screen.getByLabelText('Planned topic'), { target: { value: '  November draft  ' } });
  fireEvent.change(screen.getByLabelText('Reason for change'), { target: { value: 'Schedule the November event' } });
}
afterEach(cleanup);

describe('Commissioner planning persistence', () => {
  it('saves the exact planned topic, local schedule and original judging instructions through the audited mutation', async () => {
    const mutate = vi.fn<CommissionerMutate>().mockResolvedValue(result);
    render(<Harness mutate={mutate} />);
    fillPlan();
    fireEvent.change(screen.getByLabelText('Scheduled start'), { target: { value: '2026-11-20T18:30' } });
    fireEvent.change(screen.getByLabelText('Deadline (optional)'), { target: { value: '2026-11-21T18:30' } });
    fireEvent.change(screen.getByLabelText('Judging instructions (optional)'), { target: { value: '  All media are eligible.  ' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Rounds' }), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save planned draft' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Planned draft saved.'));
    expect(mutate).toHaveBeenCalledWith('upsert_plan', {
      topic: 'November draft', notes: '', ai_context: 'All media are eligible.', num_rounds: 7, is_live: false, live_settings: DEFAULT_LIVE_SETTINGS,
      scheduled_at: new Date('2026-11-20T18:30').toISOString(), due_at: new Date('2026-11-21T18:30').toISOString(), status: 'planned', draft_id: null, preset_id: null,
    }, 'Schedule the November event', expect.stringMatching(/^[0-9a-f-]{36}$/));
  });

  it('returns the commissioner pane to the title when opening and saving a long plan form', async () => {
    const mutate = vi.fn<CommissionerMutate>().mockResolvedValue(result);
    const view = render(<div className="da-commissioner-pane"><Harness data={{ ...empty, plans: [plan] }} mutate={mutate} /></div>);
    const pane = view.container.firstElementChild as HTMLElement;
    pane.scrollTop = 850;
    fillPlan();
    expect(pane.scrollTop).toBe(0);
    pane.scrollTop = 1200;
    fireEvent.click(screen.getByRole('button', { name: 'Save planned draft' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Planned draft saved.'));
    expect(pane.scrollTop).toBe(0);
    expect(screen.getByRole('heading', { name: 'Film classics' })).toBeVisible();
  });

  it('retains the request UUID for an unchanged retry instead of duplicating a committed plan', async () => {
    const mutate = vi.fn<CommissionerMutate>().mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValueOnce(result);
    render(<Harness mutate={mutate} />);
    fillPlan();
    fireEvent.click(screen.getByRole('button', { name: 'Save planned draft' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection interrupted');
    expect(screen.getByLabelText('Planned topic')).toHaveValue('  November draft  ');
    fireEvent.click(screen.getByRole('button', { name: 'Save planned draft' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Planned draft saved.'));
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(mutate.mock.calls[1]).toEqual(mutate.mock.calls[0]);
  });

  it('reuses a plan in creation and links a real assigned draft with its expected version without starting that draft', async () => {
    const mutate = vi.fn<CommissionerMutate>().mockResolvedValue(result);
    const draft = { id: 'draft-2', topic: 'Created LIVE draft', status: 'setup', is_live: true, num_rounds: 7, created_at: '', updated_at: '', current_pick_user_id: null, current_pick_number: 0, pick_deadline_at: null, clock_started_at: null, clock_paused_at: null };
    render(<Harness data={{ ...empty, plans: [plan], drafts: [draft] }} mutate={mutate} />);
    expect(screen.getByRole('link', { name: 'Use in draft' })).toHaveAttribute('href', '/drafts/create?plan=plan-1&season=season-1');
    fireEvent.click(screen.getByRole('button', { name: 'Edit plan Film classics' }));
    fireEvent.change(screen.getByLabelText('Linked season draft'), { target: { value: 'draft-2' } });
    fireEvent.change(screen.getByLabelText('Plan status'), { target: { value: 'launched' } });
    fireEvent.change(screen.getByLabelText('Reason for change'), { target: { value: 'Attach the event we created' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save planned draft' }));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate.mock.calls[0][0]).toBe('upsert_plan');
    expect(mutate.mock.calls[0][1]).toMatchObject({ id: 'plan-1', expected_version: 4, draft_id: 'draft-2', status: 'launched', is_live: true, topic: plan.topic, ai_context: plan.ai_context });
    expect(draft.status).toBe('setup');
  });

  it('requires a recipient and explicit confirmation, and only reports a reminder after a notification receipt', async () => {
    const mutate = vi.fn<CommissionerMutate>().mockResolvedValue({ ...result, record: { notification_id: 'notification-1' } });
    render(<Harness data={{ ...empty, plans: [plan] }} mutate={mutate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remind participants about Film classics' }));
    expect(screen.getByRole('dialog', { name: 'Send plan reminder' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Send in-app reminder' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Recipient'), { target: { value: 'player-1' } });
    fireEvent.change(screen.getByLabelText('Reminder reason'), { target: { value: 'Please check the upcoming draft topic' } });
    expect(mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Send in-app reminder' }));
    expect(await screen.findByRole('status')).toHaveTextContent('In-app reminder delivered.');
    expect(mutate).toHaveBeenCalledWith('send_reminder', { kind: 'plan', plan_id: 'plan-1', target_user_id: 'player-1' }, 'Please check the upcoming draft topic', expect.any(String));
  });

  it('does not claim delivery from an acknowledgement without a notification ID', async () => {
    const mutate = vi.fn<CommissionerMutate>().mockResolvedValue(result);
    render(<Harness data={{ ...empty, plans: [plan] }} mutate={mutate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remind participants about Film classics' }));
    fireEvent.change(screen.getByLabelText('Recipient'), { target: { value: 'player-1' } });
    fireEvent.change(screen.getByLabelText('Reminder reason'), { target: { value: 'Check the next planned topic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send in-app reminder' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('did not return a delivery receipt');
    expect(screen.queryByText('In-app reminder delivered.')).toBeNull();
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('keeps typed reminder details focused across snapshot refreshes and retries the native form without losing its intent', async () => {
    const mutate = vi.fn<CommissionerMutate>().mockRejectedValueOnce(new Error('Connection interrupted'))
      .mockResolvedValueOnce({ ...result, record: { notification_id: 'notification-retry' } });
    const view = render(<Harness data={{ ...empty, plans: [plan] }} mutate={mutate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remind participants about Film classics' }));
    const dialog = screen.getByRole('dialog', { name: 'Send plan reminder' });
    const details = within(dialog).getByRole('region', { name: 'Plan confirmation details' });
    const recipient = within(dialog).getByLabelText('Recipient');
    const reason = within(dialog).getByLabelText('Reminder reason') as HTMLTextAreaElement;
    fireEvent.change(recipient, { target: { value: 'player-1' } });
    fireEvent.change(reason, { target: { value: 'Please check the planned topic.\nBring your next picks.' } });
    reason.focus();
    view.rerender(<Harness data={{ ...empty, plans: [{ ...plan, notes: 'Refreshed workspace details' }] }} mutate={mutate} />);
    expect(reason).toHaveFocus();
    expect(reason).toHaveValue('Please check the planned topic.\nBring your next picks.');
    expect(recipient).toHaveValue('player-1');
    const submit = within(dialog).getByRole('button', { name: 'Send in-app reminder' }) as HTMLButtonElement;
    expect(details).toContainElement(reason);
    expect(details).not.toContainElement(submit);
    expect(submit.form).toBe(reason.form);
    expect(mutate).not.toHaveBeenCalled();

    fireEvent.submit(reason.form!);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Connection interrupted');
    expect(reason).toHaveValue('Please check the planned topic.\nBring your next picks.');
    expect(submit).toBeEnabled();
    fireEvent.submit(reason.form!);
    expect(await screen.findByRole('status')).toHaveTextContent('In-app reminder delivered.');
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(mutate.mock.calls[1]).toEqual(mutate.mock.calls[0]);
  });

  it('keeps deletion confirmation separate from typed details and cancels without a mutation', async () => {
    const mutate = vi.fn<CommissionerMutate>().mockResolvedValue(result);
    render(<Harness data={{ ...empty, plans: [plan] }} mutate={mutate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete plan Film classics' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete planned draft' });
    const details = within(dialog).getByRole('region', { name: 'Plan confirmation details' });
    const reason = within(dialog).getByLabelText('Reason for deletion');
    fireEvent.change(reason, { target: { value: 'The event is being moved.' } });
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    expect(details).toContainElement(reason);
    expect(details).not.toContainElement(cancel);
    expect(within(dialog).getByRole('button', { name: 'Delete planned draft' })).toBeEnabled();
    fireEvent.click(cancel);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mutate).not.toHaveBeenCalled();
  });

  it('saves a reusable LIVE preset without changing the existing scoring scope or presentation semantics', async () => {
    const mutate = vi.fn<CommissionerMutate>().mockResolvedValue(result);
    render(<Harness mutate={mutate} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Presets' }));
    fireEvent.click(screen.getByRole('button', { name: 'New preset' }));
    fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: 'Club show' } });
    fireEvent.change(screen.getByLabelText('Judging instructions (optional)'), { target: { value: 'Keep all original topic interpretations eligible.' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'LIVE event' }));
    fireEvent.click(screen.getByText(/LIVE stage settings/));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Start each clock automatically' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Broadcast the scored report' }));
    fireEvent.change(screen.getByLabelText('Reason for change'), { target: { value: 'Save our reusable stage setup' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save preset' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Preset saved.');
    expect(mutate.mock.calls[0][0]).toBe('upsert_preset');
    expect(mutate.mock.calls[0][1]).toEqual({ name: 'Club show', config: { num_rounds: 5, ai_context: 'Keep all original topic interpretations eligible.', is_live: true, live_settings: { ...DEFAULT_LIVE_SETTINGS, autoStartClock: false, reportBroadcast: false } } });
  });

  it('keeps pending saves from changing the form after a season handoff', async () => {
    let resolve!: (value: typeof result) => void;
    const mutate = vi.fn<CommissionerMutate>().mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = render(<Harness mutate={mutate} />);
    fillPlan();
    fireEvent.click(screen.getByRole('button', { name: 'Save planned draft' }));
    view.rerender(<Harness mutate={mutate} seasonId="season-2" />);
    fillPlan();
    await act(async () => resolve(result));
    expect(screen.getByLabelText('Planned topic')).toHaveValue('  November draft  ');
    expect(screen.queryByText('Planned draft saved.')).toBeNull();
  });
});
