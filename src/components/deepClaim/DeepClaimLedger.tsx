import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, FileText } from 'lucide-react';
import type { DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { activityDateFormatter, activityPresentation, activityTitle, DEEP_CLAIM_ACTIVITY_CATEGORIES, orderCompanyActivity, type DeepClaimActivityArt, type DeepClaimActivityCategory } from '@/lib/deepClaim/ledger';
import { DeepClaimBusinessIcon, DeepClaimEquipmentIcon, DeepClaimPortrait, DeepClaimResourceIcon } from './renderer/DeepClaimIcons';
import { ClaimButton, ClaimEmpty } from './DeepClaimPrimitives';
import './deepClaimLedger.css';

const PAGE_SIZE = 6;
const CATEGORY_ART: Record<DeepClaimActivityCategory, DeepClaimActivityArt> = { all: 'record', mine: 'pickaxe', crew: 'worker', workshop: 'production', company: 'office', trade: 'contract' };

function ActivityArt({ kind }: { kind: DeepClaimActivityArt }) {
  if (kind === 'worker') return <DeepClaimPortrait specialty="miner" />;
  if (kind === 'pickaxe' || kind === 'cargo' || kind === 'survey') return <DeepClaimEquipmentIcon archetype={kind === 'pickaxe' ? 'iron_pickaxe' : kind === 'cargo' ? 'hauler_frame' : 'survey_kit'} decorative />;
  if (kind === 'production') return <DeepClaimResourceIcon resourceId="iron_bar" decorative />;
  if (kind === 'record') return <FileText size={23} aria-hidden="true" />;
  return <DeepClaimBusinessIcon kind={kind} decorative />;
}

/** A compact view of the server's recent receipts, not a second economic history. */
export function DeepClaimLog({ snapshot }: { snapshot: DeepClaimSnapshot }) {
  const [selection, setSelection] = useState<{ category: DeepClaimActivityCategory; page: number; source: string; step: number }>({ category: 'all', page: 0, source: '', step: 0 });
  const ordered = orderCompanyActivity(snapshot.log);
  const source = ordered.map(entry => `${entry.id}:${entry.created_at}`).join('|');
  const filtered = ordered.filter(entry => selection.category === 'all' || activityPresentation(entry.kind).category === selection.category);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = selection.source === source ? Math.min(selection.page, pages - 1) : 0;
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const dateFormatter = activityDateFormatter(snapshot.company?.timezone);
  const listId = useId();
  const listHeading = useRef<HTMLHeadingElement>(null);
  const root = useRef<HTMLElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const pager = useRef<HTMLElement>(null);
  const navigation = useRef<'page' | 'category' | null>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  useLayoutEffect(() => {
    const pane = results.current?.closest<HTMLElement>('.dcl-pane');
    const header = pane?.querySelector<HTMLElement>('.dcl-field-log-header.is-ledger');
    const compactControls = () => !!controls.current && getComputedStyle(controls.current).position === 'sticky';
    const measureHeader = () => root.current?.style.setProperty('--dcl-activity-switcher-height', `${header?.getBoundingClientRect().height ?? 0}px`);
    measureHeader();
    if (navigation.current) {
      const requested = navigation.current; navigation.current = null;
      if (requested === 'page') listHeading.current?.focus({ preventScroll: true });
      // Keep the existing pane scroller. The compact landscape control bar
      // sits beside the pager; neither may obscure the first new receipt.
      if (pane && results.current && (requested === 'page' || compactControls())) {
        const paneTop = pane.getBoundingClientRect().top;
        const headerBottom = header?.getBoundingClientRect().bottom ?? paneTop;
        const controlsBottom = compactControls() ? controls.current!.getBoundingClientRect().bottom : paneTop;
        pane.scrollTop += results.current.getBoundingClientRect().top - Math.max(paneTop, headerBottom, controlsBottom) - 8;
      }
    }
    const measure = () => {
      measureHeader();
      const last = results.current?.querySelector('li:last-child');
      const bottom = compactControls() && pane ? pane.getBoundingClientRect().bottom : pager.current?.getBoundingClientRect().top;
      setMoreBelow(!!last && bottom != null && last.getBoundingClientRect().bottom > bottom + 1);
    };
    measure();
    pane?.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (pane) observer?.observe(pane);
    if (header) observer?.observe(header);
    if (controls.current) observer?.observe(controls.current);
    if (results.current) observer?.observe(results.current);
    return () => { pane?.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); observer?.disconnect(); };
  }, [page, selection.category, selection.step, source, visible.length]);
  function turnPage(next: number) { navigation.current = 'page'; setSelection(value => ({ category: value.category, page: next, source, step: value.step + 1 })); }
  function chooseCategory(category: DeepClaimActivityCategory) { navigation.current = 'category'; setSelection(value => ({ category, page: 0, source, step: value.step + 1 })); }

  return <section ref={root} className="dcl-activity" aria-label="Company ledger">
    <div className="dcl-section-heading"><div><h2>Ledger</h2><p>Latest {ordered.length} {ordered.length === 1 ? 'record' : 'records'}</p></div><span className="dcl-activity-heading-art" aria-hidden="true"><ActivityArt kind="contract" /></span></div>
    <div ref={controls} className="dcl-activity-control-row">
    <div className="dcl-activity-categories" role="group" aria-label="Activity category">{DEEP_CLAIM_ACTIVITY_CATEGORIES.map(category => {
      const count = category.key === 'all' ? ordered.length : ordered.filter(entry => activityPresentation(entry.kind).category === category.key).length;
      return <button type="button" key={category.key} aria-pressed={selection.category === category.key} aria-controls={listId} aria-label={`${category.label} activity: ${count}`} onClick={() => chooseCategory(category.key)}>
        <span className="dcl-activity-category-art" aria-hidden="true"><ActivityArt kind={CATEGORY_ART[category.key]} /></span><strong>{category.label}</strong><small>{count}</small>
      </button>;
    })}</div>
    <nav ref={pager} className="dcl-activity-pages" aria-label="Ledger pages">
      <ClaimButton className="is-small" disabled={page === 0} onClick={() => turnPage(page - 1)} aria-label="Previous activity"><ArrowLeft size={16} aria-hidden="true" /></ClaimButton>
      <span className="dcl-activity-page-info"><span role="status" aria-live="polite" aria-atomic="true">{filtered.length ? `${page * PAGE_SIZE + 1}–${Math.min(filtered.length, (page + 1) * PAGE_SIZE)} / ${filtered.length}` : '0 records'}</span><small aria-hidden="true" data-visible={moreBelow}>Scroll to read</small></span>
      <ClaimButton className="is-small" disabled={page >= pages - 1} onClick={() => turnPage(page + 1)} aria-label="Next activity"><ArrowRight size={16} aria-hidden="true" /></ClaimButton>
    </nav>
    </div>
    <h3 className="sr-only" ref={listHeading} tabIndex={-1}>Recent activity, page {page + 1} of {pages}</h3>
    <div ref={results} id={listId} className="dcl-activity-results">
      {visible.length > 0 ? <ol className="dcl-activity-list" role="list" aria-label="Recent activity" start={page * PAGE_SIZE + 1}>{visible.map(entry => {
        const presentation = activityPresentation(entry.kind);
        return <li key={entry.id} data-activity-category={presentation.category}>
          <span className="dcl-activity-art" aria-hidden="true"><ActivityArt kind={presentation.art} /></span>
          <div><span className="dcl-activity-kind">{presentation.label}</span><strong>{activityTitle(entry)}</strong><time dateTime={entry.created_at}>{dateFormatter.format(new Date(entry.created_at))}</time></div>
        </li>;
      })}</ol> : <ClaimEmpty title={ordered.length ? `No ${DEEP_CLAIM_ACTIVITY_CATEGORIES.find(category => category.key === selection.category)?.label.toLowerCase()} activity` : 'No activity yet'} icon={<FileText aria-hidden="true" />} />}
    </div>
  </section>;
}
