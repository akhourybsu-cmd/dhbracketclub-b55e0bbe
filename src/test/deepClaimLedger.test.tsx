import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DeepClaimLog } from '@/components/deepClaim/DeepClaimPanels';
import { activityDateFormatter, activityPresentation, orderCompanyActivity } from '@/lib/deepClaim/ledger';
import type { DeepClaimLogEntry } from '@/lib/deepClaim/types';
import { companySnapshot } from './fixtures/deepClaim';

afterEach(cleanup);

const kinds = {
  company: ['founded', 'upgraded', 'research_started', 'research_completed', 'milestone_claimed'],
  mine: ['dispatched', 'haul_ready', 'collected', 'field_return', 'find_resolved'],
  crew: ['hired', 'trained', 'equipped', 'repaired', 'retired'],
  workshop: ['production_started', 'production_ready', 'production_collected'],
  trade: ['sold', 'contract_completed'],
} as const;
function entry(kind: string, id = kind, created_at = '2026-11-01T12:00:00Z'): DeepClaimLogEntry {
  return { id, kind, title: `Server receipt: ${id}.`, created_at };
}

describe('Deep Claim server receipt presentation', () => {
  it.each(Object.entries(kinds))('classifies every existing %s receipt by its actual server kind', (category, entries) => {
    for (const kind of entries) expect(activityPresentation(kind).category).toBe(category);
  });

  it('recognizes sold rather than guessing from a sell substring, and preserves future kinds', () => {
    expect(activityPresentation('sold')).toMatchObject({ category: 'trade', label: 'Sale', art: 'contract' });
    for (const kind of ['new_company_event', 'reselling_unknown', '__proto__', 'constructor']) {
      expect(activityPresentation(kind)).toEqual({ category: 'other', label: 'Record', art: 'record' });
    }
  });

  it('orders mixed timestamps and tied IDs deterministically without modifying the source', () => {
    const records = [entry('hired', 'a'), entry('sold', 'c'), entry('founded', 'b'), entry('collected', 'recent', '2026-11-02T12:00:00Z')];
    const original = structuredClone(records);
    expect(orderCompanyActivity(records).map(item => item.id)).toEqual(['recent', 'c', 'b', 'a']);
    expect(orderCompanyActivity([...records].reverse())).toEqual(orderCompanyActivity(records));
    expect(records).toEqual(original);
  });

  it('uses the company calendar across daylight saving time and safely falls back for an invalid zone', () => {
    const formatter = activityDateFormatter('America/New_York');
    const before = formatter.formatToParts(new Date('2026-11-01T05:30:00Z'));
    const after = formatter.formatToParts(new Date('2026-11-01T06:30:00Z'));
    expect(before.find(part => part.type === 'hour')?.value).toBe(after.find(part => part.type === 'hour')?.value);
    expect(before.find(part => part.type === 'timeZoneName')?.value).not.toBe(after.find(part => part.type === 'timeZoneName')?.value);
    expect(activityDateFormatter('not/a/timezone').resolvedOptions().timeZone).toBe('UTC');
    expect(activityDateFormatter(undefined).resolvedOptions().timeZone).toBe('UTC');
  });
});

describe('Deep Claim compact illustrated ledger', () => {
  it('uses bounded pages, meaningful category art and truthful recent-record counts', () => {
    const snapshot = companySnapshot();
    snapshot.log = Object.values(kinds).flatMap(entries => entries.map(kind => entry(kind)));
    const original = structuredClone(snapshot);
    render(<DeepClaimLog snapshot={snapshot} />);
    const ledger = screen.getByRole('region', { name: 'Company ledger' });
    expect(within(ledger).getByText('Latest 20 records')).toBeInTheDocument();
    expect(within(ledger).getByRole('group', { name: 'Activity category' })).toBeInTheDocument();
    expect(within(ledger).getByRole('button', { name: 'All activity: 20' })).toHaveAttribute('aria-pressed', 'true');
    const seen = new Set<string>();
    for (let page = 0; page < 4; page++) {
      const list = within(ledger).getByRole('list', { name: 'Recent activity' });
      const rows = within(list).getAllByRole('listitem');
      expect(rows.length).toBeLessThanOrEqual(6);
      rows.forEach(row => seen.add(within(row).getByText(/^Server receipt:/).textContent!));
      expect(ledger.querySelectorAll('.dcl-activity-art>svg')).toHaveLength(rows.length);
      if (page < 3) fireEvent.click(within(ledger).getByRole('button', { name: 'Next activity' }));
    }
    expect(seen.size).toBe(20);
    expect(within(ledger).getByRole('status')).toHaveTextContent('19–20 / 20');
    expect(within(ledger).getByRole('button', { name: 'Next activity' })).toBeDisabled();
    expect(snapshot).toEqual(original);
  });

  it.each([
    ['Mine', 'mine', 5], ['Crew', 'crew', 5], ['Workshop', 'workshop', 3], ['Company', 'company', 5], ['Trade', 'trade', 2],
  ] as const)('filters %s without inventing or losing matching receipts', (label, category, count) => {
    const snapshot = companySnapshot();
    snapshot.log = Object.values(kinds).flatMap(entries => entries.map(kind => entry(kind)));
    render(<DeepClaimLog snapshot={snapshot} />);
    const filter = screen.getByRole('button', { name: `${label} activity: ${count}` });
    filter.focus(); fireEvent.click(filter);
    expect(filter).toHaveFocus();
    expect(filter).toHaveAttribute('aria-pressed', 'true');
    const rows = within(screen.getByRole('list', { name: 'Recent activity' })).getAllByRole('listitem');
    expect(rows).toHaveLength(count);
    rows.forEach(row => expect(row).toHaveAttribute('data-activity-category', category));
    expect(screen.getByRole('button', { name: 'Previous activity' })).toBeDisabled();
  });

  it('retains unknown server events in All without mislabeling them as another activity', () => {
    const snapshot = companySnapshot();
    snapshot.log = [entry('future_mining_event'), entry('sold')];
    render(<DeepClaimLog snapshot={snapshot} />);
    expect(screen.getByText('Server receipt: future_mining_event.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All activity: 2' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mine activity: 0' }));
    expect(screen.getByText('No mine activity')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Recent activity' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'All activity: 2' }));
    expect(screen.getByText('Server receipt: future_mining_event.')).toBeInTheDocument();
  });

  it('focuses the new page heading and resets pages when filters or received record identities change', () => {
    const snapshot = companySnapshot();
    snapshot.log = Array.from({ length: 14 }, (_, index) => entry('sold', String(index).padStart(2, '0')));
    const ui = render(<DeepClaimLog snapshot={snapshot} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next activity' }));
    expect(screen.getByRole('heading', { name: 'Recent activity, page 2 of 3' })).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('7–12 / 14');
    fireEvent.click(screen.getByRole('button', { name: 'Trade activity: 14' }));
    expect(screen.getByRole('status')).toHaveTextContent('1–6 / 14');
    fireEvent.click(screen.getByRole('button', { name: 'Next activity' }));
    ui.rerender(<DeepClaimLog snapshot={{ ...snapshot, log: [entry('sold', 'new', '2026-11-02T12:00:00Z'), ...snapshot.log] }} />);
    expect(screen.getByRole('status')).toHaveTextContent('1–6 / 15');
    expect(screen.getByText('Server receipt: new.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trade activity: 15' })).toHaveAttribute('aria-pressed', 'true');
    ui.rerender(<DeepClaimLog snapshot={{ ...snapshot, log: [entry('hired')] }} />);
    expect(screen.getByText('No trade activity')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('0 records');
    expect(screen.getByRole('button', { name: 'Previous activity' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next activity' })).toBeDisabled();
  });

  it('preserves the exact server title and UTC timestamp while displaying company-local time', () => {
    const snapshot = companySnapshot();
    const record = { ...entry('sold'), title: '9 units sold for $36.' };
    snapshot.log = [record];
    render(<DeepClaimLog snapshot={snapshot} />);
    expect(screen.getByText(record.title)).toBeInTheDocument();
    const time = screen.getByText(activityDateFormatter(snapshot.company!.timezone).format(new Date(record.created_at)));
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('datetime', record.created_at);
    expect(screen.queryByRole('button', { name: /collect|claim|sell/i })).not.toBeInTheDocument();
  });

  it('provides a complete empty state without a fake history or active pagination', () => {
    render(<DeepClaimLog snapshot={companySnapshot()} />);
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
    expect(screen.getByText('Latest 0 records')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Ledger pages' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous activity' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next activity' })).toBeDisabled();
  });
});
