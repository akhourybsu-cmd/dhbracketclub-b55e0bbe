import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommissionerWorkspace } from '@/components/draft/commissioner/CommissionerWorkspace';
import { CommissionerImpactList } from '@/components/draft/commissioner/CommissionerReview';
import { commissionerSavedChanges } from '@/components/draft/commissioner/commissionerPresentation';
import { commissionerFixture } from './fixtures/commissionerWorkspace';
import type { CommissionerAudit } from '@/lib/draft/commissioner';

const wire = vi.hoisted(() => ({ fetch: vi.fn(), mutate: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'a' }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: 'club-1' }, loading: false }) }));
vi.mock('@/components/draft/commissioner/CommissionerPlanner', () => ({ CommissionerPlanner: () => <p>Real planner slot</p> }));
vi.mock('@/lib/draft/commissioner', async () => ({
  ...await vi.importActual<typeof import('@/lib/draft/commissioner')>('@/lib/draft/commissioner'),
  fetchCommissionerWorkspace: wire.fetch, mutateCommissioner: wire.mutate,
}));
beforeEach(() => { vi.resetAllMocks(); wire.fetch.mockResolvedValue(commissionerFixture()); wire.mutate.mockResolvedValue({ ok: true, record: null, audit_id: 'audit-1' }); });
afterEach(() => { cleanup(); localStorage.clear(); });
async function mount(route = '/drafts?tab=commissioner') {
  render(<MemoryRouter initialEntries={[route]}><CommissionerWorkspace seasonId="s1" seasonTitle="Season One"><button type="button">Existing season action</button></CommissionerWorkspace></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Season at a glance' });
}
function section(name: string) { fireEvent.click(screen.getByRole('tab', { name })); }
function adjustments() { section('Points'); fireEvent.click(screen.getByRole('button', { name: 'Adjustments' })); }

describe('Commissioner workspace persisted actions', () => {
  it('exposes a retryable load failure without publishing management data, then restores all sections', async () => {
    wire.fetch.mockRejectedValueOnce(new Error('offline'));
    render(<MemoryRouter><CommissionerWorkspace seasonId="s1" /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Workspace unavailable' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Season at a glance' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry workspace' }));
    expect(await screen.findByRole('heading', { name: 'Season at a glance' })).toBeVisible();
    expect(screen.getByRole('tablist', { name: 'Commissioner sections' })).toBeVisible();
    section('Planner'); expect(screen.getByText('Real planner slot')).toBeVisible();
    section('Season tools'); expect(screen.getByRole('heading', { name: 'Season format' })).toBeVisible();
  });

  it('cancels a points preview without writes, then preserves exact payload, reason and request identity across a failed confirmation', async () => {
    await mount(); adjustments();
    fireEvent.change(screen.getByLabelText('Points member'), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText('Point change'), { target: { value: '-8' } });
    fireEvent.change(screen.getByLabelText('Adjustment reason'), { target: { value: 'League ruling correction' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview adjustment' }));
    let dialog = await screen.findByRole('dialog', { name: 'Point adjustment' });
    expect(within(dialog).getByText('7 pts')).toBeVisible();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel preview' }));
    expect(wire.mutate).not.toHaveBeenCalled();
    wire.mutate.mockRejectedValueOnce(new Error('Connection interrupted'));
    fireEvent.click(screen.getByRole('button', { name: 'Preview adjustment' }));
    dialog = await screen.findByRole('dialog', { name: 'Point adjustment' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm adjustment' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Connection interrupted');
    expect(within(dialog).getByLabelText('Reason for this change')).toHaveValue('League ruling correction');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm adjustment' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(wire.mutate).toHaveBeenCalledTimes(2);
    expect(wire.mutate.mock.calls[0].slice(0,4)).toEqual(['s1','add_adjustment',{ user_id:'a',delta:-8 },'League ruling correction']);
    expect(wire.mutate.mock.calls[0][4]).toBe(wire.mutate.mock.calls[1][4]);
  });

  it('opens a draft-removal deep link with best-of impact and never deletes the underlying draft', async () => {
    const data = commissionerFixture(); data.entries = data.entries.slice(0,1); wire.fetch.mockResolvedValue(data);
    render(<MemoryRouter initialEntries={['/drafts?tab=commissioner&tool=points&draft=d1&season=s1']}><CommissionerWorkspace seasonId="s1" /></MemoryRouter>);
    const select = await screen.findByLabelText('Draft to remove');
    expect(select).toHaveValue('d1');
    fireEvent.change(screen.getByLabelText('Removal reason'), { target: { value:'Incorrect season membership' } });
    fireEvent.click(screen.getByRole('button', { name:'Review removal' }));
    const dialog = await screen.findByRole('dialog', { name:'Remove draft from season' });
    expect(within(dialog).getAllByText('Removed from standings')).toHaveLength(2);
    expect(wire.mutate).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name:'Confirm removal' }));
    await waitFor(() => expect(wire.mutate).toHaveBeenCalledTimes(1));
    expect(wire.mutate.mock.calls[0].slice(0,4)).toEqual(['s1','remove_draft',{draft_id:'d1'},'Incorrect season membership']);
    expect(data.drafts).toHaveLength(3);
  });

  it('shows the original dispute context and requires an audited rationale before closing the case', async () => {
    const data=commissionerFixture();
    data.disputes.push({ id:'q1',draft_id:'d1',pick_id:'pick-d1-a',user_id:'a',reason:'This fits the topic',status:'pending',created_at:'2026-10-01',resolved_at:null,commissioner_rationale:null,resolution:null });
    data.results[0].pick_ratings=[{pick_id:'pick-d1-a',score:9,explanation:'Strong topic fit'}]; wire.fetch.mockResolvedValue(data);
    await mount(); section('Disputes 1');
    expect(screen.getByText('Choice d1-a')).toBeVisible(); expect(screen.getByText('9/10')).toBeVisible(); expect(screen.getByText('Strong topic fit')).toBeVisible(); expect(screen.getByText('This fits the topic')).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'Review rejection'}));
    const dialog=await screen.findByRole('dialog',{name:'Reject dispute'});
    expect(within(dialog).getByRole('button',{name:'Confirm rejection'})).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Reason for this change'),{target:{value:'The original explanation remains valid'}});
    fireEvent.click(within(dialog).getByRole('button',{name:'Confirm rejection'}));
    await waitFor(()=>expect(wire.mutate).toHaveBeenCalledTimes(1));
    expect(wire.mutate.mock.calls[0].slice(0,4)).toEqual(['s1','reject_dispute',{dispute_id:'q1'},'The original explanation remains valid']);
  });

  it('requires explicit reminder confirmation and verifies a real in-app notification receipt', async () => {
    const data=commissionerFixture(); data.drafts[1].status='in_progress'; data.drafts[1].current_pick_user_id='a'; data.drafts[1].pick_deadline_at='2026-01-01T00:00:00Z'; data.picks=data.picks.filter(pick=>pick.draft_id!=='d2'); wire.fetch.mockResolvedValue(data);
    await mount(); section('Participation');
    fireEvent.click(screen.getByRole('button',{name:'Review reminder'}));
    let dialog=await screen.findByRole('dialog',{name:'Send player reminder'});
    fireEvent.click(within(dialog).getByRole('button',{name:'Cancel preview'})); expect(wire.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Review reminder'})); dialog=await screen.findByRole('dialog',{name:'Send player reminder'});
    fireEvent.change(within(dialog).getByLabelText('Reminder reason'),{target:{value:'Your next selection is waiting'}});
    fireEvent.click(within(dialog).getByRole('button',{name:'Send reminder'}));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('delivery could not be verified');
    expect(wire.mutate.mock.calls[0].slice(0,4)).toEqual(['s1','send_reminder',{kind:'pick',draft_id:'d2',target_user_id:'a'},'Your next selection is waiting']);
    expect(screen.queryByText('Reminder sent as an in-app notification.')).not.toBeInTheDocument();
  });

  it('reviews real season format settings and sends only supported fields after confirmation', async () => {
    await mount(); section('Season tools');
    fireEvent.change(screen.getByLabelText('Regular draft target'),{target:{value:'5'}}); fireEvent.change(screen.getByLabelText('Best-of results'),{target:{value:'3'}}); fireEvent.change(screen.getByLabelText('Season subtitle'),{target:{value:'Final stretch'}});
    fireEvent.click(screen.getByRole('button',{name:'Review season format'}));
    const dialog=await screen.findByRole('dialog',{name:'Update season format'}); expect(wire.mutate).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText('Reason for this change'),{target:{value:'Extend the season by agreement'}});
    fireEvent.click(within(dialog).getByRole('button',{name:'Confirm season format'}));
    await waitFor(()=>expect(wire.mutate).toHaveBeenCalledTimes(1));
    expect(wire.mutate.mock.calls[0].slice(0,4)).toEqual(['s1','update_season',{subtitle:'Final stretch',regular_season_drafts:5,best_of:3},'Extend the season by agreement']);
  });
});

describe('Commissioner presentation integrity',()=>{
  it('labels an unapplied ledger preview without rendering null points or a removed standing',()=>{
    render(<CommissionerImpactList rows={[{userId:'a',displayName:'Player a',before:0,after:null,delta:0,rowRemoved:false,beforeSeed:null,afterSeed:null,beforeRank:null,afterRank:null,seedsLocked:false}]} />);
    expect(screen.getByText('Awaiting a result')).toBeVisible(); expect(screen.getByText('The adjustment ledger awaits the first eligible result.')).toBeVisible(); expect(screen.queryByText('null pts')).not.toBeInTheDocument(); expect(screen.queryByText('Removed from standings')).not.toBeInTheDocument();
  });
  it('formats whitelisted saved field changes using visible names and never exposes audit IDs or arbitrary payloads',()=>{
    const record={before_data:{commissioner_user_id:'a',best_of:2,private_token:'old-secret'},after_data:{commissioner_user_id:'b',best_of:3,private_token:'new-secret'}} as CommissionerAudit;
    const changes=commissionerSavedChanges(record,commissionerFixture());
    expect(changes).toContainEqual({label:'Commissioner',before:'Player a',after:'Player b'}); expect(changes).toContainEqual({label:'Best-of results',before:'2',after:'3'}); expect(JSON.stringify(changes)).not.toContain('secret'); expect(changes).toHaveLength(2);
  });
});
