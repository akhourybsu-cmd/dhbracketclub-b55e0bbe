import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimBusiness, type ClaimBusinessView } from '@/components/deepClaim/DeepClaimBusiness';
import type { DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseFourSnapshot } from './fixtures/deepClaimPhase4';

afterEach(cleanup);
const start = Date.parse('2026-11-01T12:00:00Z');
function researchReport() {
  const data = phaseFourSnapshot();
  data.business!.research = [{ key: 'excavation_1', status: 'active', started_at: new Date(start).toISOString(), completes_at: new Date(start + 600_000).toISOString(), completed_at: null }];
  return data;
}
function Office({ data, now, view = 'company', refresh = vi.fn(), startResearch = vi.fn() }: { data: DeepClaimSnapshot; now: number; view?: ClaimBusinessView; refresh?: () => void; startResearch?: () => Promise<DeepClaimSnapshot> }) {
  const noop = vi.fn();
  return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DeepClaimBusiness snapshot={data} now={now} view={view} onView={noop} onClose={noop} onBuild={noop} onHire={noop} onStores={noop} onConfirmed={noop} onRefresh={refresh} busy={false} readOnly={false} actions={{ startResearch, fulfillContract: noop, claimMilestone: noop }} /></MemoryRouter>;
}

describe('Deep Claim visual Office progress', () => {
  it('resumes the persisted research schedule instead of restarting an animated loading estimate', () => {
    const data = researchReport(), original = structuredClone(data);
    const ui = render(<Office data={data} now={start + 150_000} />);
    expect(screen.getByRole('progressbar', { name: 'Research elapsed time' })).toHaveAttribute('aria-valuenow', '25');
    ui.rerender(<Office data={data} now={start + 450_000} />);
    expect(screen.getByRole('progressbar', { name: 'Research elapsed time' })).toHaveAttribute('aria-valuenow', '75');
    expect(data).toEqual(original);
    ui.unmount();
    render(<Office data={data} now={start + 450_000} />);
    expect(screen.getByRole('progressbar', { name: 'Research elapsed time' })).toHaveAttribute('aria-valuenow', '75');
  });

  it('keeps an elapsed project unconfirmed until the server supplies completion', () => {
    const data = researchReport(), refresh = vi.fn(), startResearch = vi.fn();
    const ui = render(<Office data={data} now={start + 900_000} refresh={refresh} startResearch={startResearch} />);
    expect(screen.getByRole('progressbar', { name: 'Research elapsed time' })).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('Awaiting completion report')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check research completion' }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(startResearch).not.toHaveBeenCalled();
    expect(data.business!.research[0].status).toBe('active');
    const completed = structuredClone(data);
    completed.business!.research[0] = { ...completed.business!.research[0], status: 'completed', completed_at: new Date(start + 600_000).toISOString() };
    completed.business!.stats.completed_research = 1;
    ui.rerender(<Office data={completed} now={start + 900_000} refresh={refresh} />);
    expect(screen.queryByRole('progressbar', { name: 'Research elapsed time' })).not.toBeInTheDocument();
  });

  it('bounds future and invalid research schedules without reporting false completion', () => {
    const data = researchReport();
    const ui = render(<Office data={data} now={start - 1000} />);
    expect(screen.getByRole('progressbar', { name: 'Research elapsed time' })).toHaveAttribute('aria-valuenow', '0');
    const invalid = structuredClone(data);
    invalid.business!.research[0].completes_at = 'invalid';
    ui.rerender(<Office data={invalid} now={start} />);
    expect(screen.getByRole('progressbar', { name: 'Research elapsed time' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('Refresh to check the research schedule')).toBeInTheDocument();
    expect(screen.queryByText('Awaiting completion report')).not.toBeInTheDocument();
  });

  it('shows actual collected contract materials without treating them as an already delivered order', () => {
    const data = phaseFourSnapshot(); data.resources = { stone: 19 };
    render(<Office data={data} now={start} view="contracts" />);
    const progress = screen.getByRole('progressbar', { name: 'Yard Foundations materials assembled' });
    expect(progress).toHaveAttribute('aria-valuenow', '19');
    expect(progress).toHaveAttribute('aria-valuemax', '20');
    fireEvent.click(screen.getByRole('button', { name: 'Review order Yard Foundations' }));
    const dialog = screen.getByRole('dialog', { name: 'Company Office' });
    expect(within(dialog).getByRole('button', { name: 'Deliver whole order' })).toBeDisabled();
    expect(within(dialog).getByRole('progressbar', { name: 'Stone collected for requirement' })).toHaveAttribute('aria-valuenow', '19');
    expect(data.business!.contracts[0].status).toBe('offered');
  });
});
