import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimTutorialDialogue } from '@/components/deepClaim/tutorial/DeepClaimTutorialDialogue';
import { DeepClaimTutorialOverlay } from '@/components/deepClaim/tutorial/DeepClaimTutorialOverlay';
import { DeepClaimTutorialJournal } from '@/components/deepClaim/tutorial/DeepClaimTutorialJournal';
import { DeepClaimTutorialPractice } from '@/components/deepClaim/tutorial/DeepClaimTutorialPractice';
import { DeepClaimTutorialCompletion } from '@/components/deepClaim/tutorial/DeepClaimTutorialCompletion';
import { DeepClaimGusAdvice } from '@/components/deepClaim/tutorial/DeepClaimGusAdvice';
import { placeTutorialPanel, tutorialIntersection } from '@/components/deepClaim/tutorial/spotlightLayout';
import { TUTORIAL_LESSONS } from '@/lib/deepClaim/tutorial/chapters';
import type { DialogueScene, TutorialPractice, TutorialProgress } from '@/lib/deepClaim/tutorial/types';

const scene: DialogueScene = { id: 'test.gus', title: 'The old claim', estimated_read_seconds: 5, lines: [{ id: 'gus.hello', text_key: 'gus.hello', speaker: 'gus', expression: 'amused', text: 'Forty-two years. Mind the loose board.', next: 'mara.hello' }, { id: 'mara.hello', text_key: 'mara.hello', speaker: 'mara', expression: 'neutral', text: 'Ready when you are.', next: null }] };
const practice: TutorialPractice = { id: 'practice.industry.warehouse', lesson_id: 'industry.warehouse', title: 'Room for the haul', notice: 'Safe demonstration. No stock, credits or employee energy changes.', scenario: 'A returned haul is larger than the available storage.', facts: [{ label: 'Cargo', value: 'Staged until collected' }, { label: 'Capacity', value: 'Every unit must have room' }], choices: [{ id: 'collect', label: 'Collect what fits', feedback: 'The remainder stays staged.', recommended: true }, { id: 'discard', label: 'Assume the rest disappears', feedback: 'Cargo is never silently discarded.' }], takeaway: 'Make space before collecting the remainder.', readonly: true };
const progress = (): TutorialProgress => ({ version: 1, user_id: 'u', club_id: 'c', company_id: 'company', server_now: '2026-11-02T12:00:00Z', revision: 1, active_lesson_id: 'beginner.claim', active_step_id: 'beginner.claim.deed', completed_steps: [], reviewed_lessons: ['workforce.hiring'], practiced_lessons: ['workforce.stats'], skipped_lessons: [], seen_dialogue: [], campaign_status: 'active', commentary_enabled: true, updated_at: null });
const noop = () => {};
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Instant, controlled camp dialogue', () => {
  it('advances immediately by tap or keyboard, preserves caller-controlled reading, and allows skip', () => {
    const advance = vi.fn(), skip = vi.fn(); render(<DeepClaimTutorialDialogue scene={scene} lineIndex={0} onAdvance={advance} onSkip={skip} />);
    expect(screen.getByText('Forty-two years. Mind the loose board.')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Advance dialogue' })); expect(advance).toHaveBeenCalledOnce(); expect(screen.queryByText('Ready when you are.')).not.toBeInTheDocument();
    const dialogue = screen.getByRole('region', { name: 'The old claim dialogue' }); dialogue.focus(); fireEvent.keyDown(dialogue, { key: 'Enter' }); expect(advance).toHaveBeenCalledTimes(2); fireEvent.click(screen.getByRole('button', { name: 'Skip dialogue' })); expect(skip).toHaveBeenCalledOnce();
  });
  it('shows provided history without duplicate current lines and does not hijack button key presses', () => {
    const advance = vi.fn(); render(<DeepClaimTutorialDialogue scene={scene} lineIndex={1} onAdvance={advance} onBack={noop} onSkip={noop} history={scene.lines} reducedMotion />);
    const next = screen.getByRole('button', { name: 'Continue' }); fireEvent.keyDown(next, { key: 'Enter' }); expect(advance).not.toHaveBeenCalled(); fireEvent.click(next); expect(advance).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Dialogue history' })); const history = screen.getByRole('region', { name: 'Dialogue history' }); expect(within(history).getAllByRole('listitem')).toHaveLength(2); expect(history).toHaveTextContent('Mara Flint');
  });
});

describe('Viewport-aware guide geometry', () => {
  const bounds = { left: 8, top: 8, width: 304, height: 552 };
  it.each([{ left: 80, top: 440, width: 160, height: 50 }, { left: 8, top: 70, width: 304, height: 390 }, { left: 80, top: 10, width: 180, height: 44 }])('keeps the panel off the highlighted target %#', target => {
    const placement = placeTutorialPanel(bounds, target); expect(placement.noRoom).toBe(false); expect(tutorialIntersection(placement, target)).toBeNull(); expect(placement.left).toBeGreaterThanOrEqual(bounds.left); expect(placement.top + placement.height).toBeLessThanOrEqual(bounds.top + bounds.height);
  });
  it('uses a compact free strip for large map gestures and reports no room for full-viewport targets', () => {
    const map = { left: 8, top: 70, width: 304, height: 415 }; const placement = placeTutorialPanel(bounds, map); expect(placement.compact).toBe(true); expect(tutorialIntersection(placement, map)).toBeNull();
    expect(placeTutorialPanel(bounds, bounds).noRoom).toBe(true);
  });
  it('keeps a portal-constrained panel within the visible dialog and handles offscreen targets', () => {
    const host = { left: 20, top: 40, width: 280, height: 430 }; const target = { left: 25, top: 400, width: 260, height: 44 }; const placed = placeTutorialPanel(host, target); expect(tutorialIntersection(placed, host)).toEqual({ left: placed.left, top: placed.top, width: placed.width, height: placed.height }); expect(tutorialIntersection(placed, target)).toBeNull(); expect(placeTutorialPanel(host, { ...target, top: 900 }).targetVisible).toBe(false);
  });
});

describe('Nonmodal spotlight lifetime and portal scopes', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) { const raw = this.getAttribute('data-rect'); if (raw) return JSON.parse(raw); if (this.classList.contains('dct-overlay') && this.parentElement?.getAttribute('role') === 'dialog') return this.parentElement.getBoundingClientRect(); return { left: 0, top: 0, width: 390, height: 844, right: 390, bottom: 844, x: 0, y: 0, toJSON: noop }; });
  });
  it('mounts guided controls inside an existing dialog focus scope and never autofocuses away from the real target', async () => {
    const target = document.createElement('button'); target.textContent = 'Confirm'; target.dataset.dcTutorial = 'dispatch-confirm'; target.dataset.rect = JSON.stringify({ left: 100, top: 480, width: 170, height: 44, right: 270, bottom: 524 });
    const host = document.createElement('section'); host.setAttribute('role', 'dialog'); host.dataset.state = 'open'; host.dataset.rect = JSON.stringify({ left: 20, top: 40, width: 350, height: 580, right: 370, bottom: 620 }); host.append(target); document.body.append(host); target.focus();
    const exit = vi.fn(); const view = render(<DeepClaimTutorialOverlay target="dispatch-confirm" title="Review the real cost" instruction="Confirm only when ready." stepLabel="Step 2 of 3" onSkip={noop} onExit={exit} />);
    await waitFor(() => expect(screen.getByRole('region', { name: 'Tutorial guidance' }).closest('[role=dialog]')).toBe(host)); expect(target).toHaveFocus(); expect(document.querySelector('.dct-overlay')).toHaveAttribute('data-target-state', 'found'); fireEvent.click(screen.getByRole('button', { name: 'Exit tutorial' })); expect(exit).toHaveBeenCalledOnce(); view.unmount(); host.remove();
  });
  it('suppresses guidance over an unrelated reward dialog and resumes after its normal close action', async () => {
    const target = document.createElement('button'); target.dataset.dcTutorial = 'haul-collect'; target.textContent = 'Collect cargo'; target.dataset.rect = JSON.stringify({ left: 100, top: 650, width: 170, height: 44, right: 270, bottom: 694 }); document.body.append(target);
    const view = render(<DeepClaimTutorialOverlay target="haul-collect" title="Secure the haul" instruction="Wait for a confirmed warehouse transfer." stepLabel="Step 2" onSkip={noop} onExit={noop} />); await waitFor(() => expect(document.querySelector('.dct-overlay')).toHaveAttribute('data-target-id', 'haul-collect'));
    const reward = document.createElement('section'); reward.setAttribute('role', 'dialog'); reward.setAttribute('aria-label', 'Haul secured'); reward.dataset.state = 'open'; reward.dataset.rect = JSON.stringify({ left: 30, top: 200, width: 330, height: 350, right: 360, bottom: 550 });
    const close = document.createElement('button'); close.textContent = 'Back to the claim'; const closed = vi.fn(() => reward.remove()); close.addEventListener('click', closed); reward.append(close); document.body.append(reward);
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Tutorial guidance' })).not.toBeInTheDocument()); expect(document.querySelector('.dct-spotlight')).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Back to the claim' })); expect(closed).toHaveBeenCalledOnce();
    await waitFor(() => expect(document.querySelector('.dct-overlay')).toHaveAttribute('data-target-id', 'haul-collect')); expect(document.querySelector('.dct-overlay')).toHaveAttribute('data-target-state', 'found'); view.unmount(); target.remove();
  });
  it('protects an explicit opening control until the future target mounts, then switches to the real target', async () => {
    const host = document.createElement('section'); host.setAttribute('role', 'dialog'); host.dataset.state = 'open'; host.dataset.rect = JSON.stringify({ left: 20, top: 40, width: 350, height: 580, right: 370, bottom: 620 });
    const review = document.createElement('button'); review.textContent = 'Review dispatch'; review.dataset.dcTutorial = 'dispatch-review'; review.dataset.rect = JSON.stringify({ left: 190, top: 550, width: 170, height: 44, right: 360, bottom: 594 }); const clicked = vi.fn(); review.addEventListener('click', clicked); host.append(review); document.body.append(host);
    const view = render(<DeepClaimTutorialOverlay target="dispatch-quote" fallbackTargets={['dispatch-review']} title="Read the quote" instruction="Request the real preview." stepLabel="Step 2" onSkip={noop} onExit={noop} />);
    await waitFor(() => expect(document.querySelector('.dct-overlay')).toHaveAttribute('data-target-id', 'dispatch-review')); expect(document.querySelector('.dct-overlay')).toHaveAttribute('data-target-state', 'found');
    const panel = screen.getByRole('region', { name: 'Tutorial guidance' }); const placement = { left: Number.parseFloat(panel.style.left) + 20, top: Number.parseFloat(panel.style.top) + 40, width: Number.parseFloat(panel.style.width), height: Number.parseFloat(panel.style.maxHeight) }; expect(tutorialIntersection(placement, { left: 190, top: 550, width: 170, height: 44 })).toBeNull(); fireEvent.click(review); expect(clicked).toHaveBeenCalledOnce();
    const quote = document.createElement('section'); quote.dataset.dcTutorial = 'dispatch-quote'; quote.dataset.rect = JSON.stringify({ left: 35, top: 150, width: 320, height: 200, right: 355, bottom: 350 }); host.append(quote);
    await waitFor(() => expect(document.querySelector('.dct-overlay')).toHaveAttribute('data-target-id', 'dispatch-quote')); expect(screen.getByRole('region', { name: 'Tutorial guidance' }).closest('[role=dialog]')).toBe(host); view.unmount(); host.remove();
  });
  it('removes interactive helper children from compact guidance while retaining spoken instructions and visible controls', async () => {
    const target = document.createElement('div'); target.dataset.dcTutorial = 'compact-map'; target.dataset.rect = JSON.stringify({ left: 8, top: 70, width: window.innerWidth - 16, height: window.innerHeight - 174, right: window.innerWidth - 8, bottom: window.innerHeight - 104 }); document.body.append(target);
    const more = vi.fn(); const view = render(<DeepClaimTutorialOverlay target="compact-map" title="Explore your mine" instruction="Use the real map controls." stepLabel="Step 1 of 2" onSkip={noop} onExit={noop} onNext={noop} onMore={more}><button type="button">Show me</button><button type="button">Read-only alternative</button></DeepClaimTutorialOverlay>);
    await waitFor(() => expect(screen.getByRole('region', { name: 'Tutorial guidance' })).toHaveClass('is-compact'));
    expect(screen.queryByRole('button', { name: 'Show me' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Read-only alternative' })).not.toBeInTheDocument(); expect(screen.getByText('Use the real map controls.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exit tutorial' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Next tutorial step' })).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'More lesson information' })); expect(more).toHaveBeenCalledOnce();
    target.dataset.rect = JSON.stringify({ left: 100, top: 450, width: 170, height: 44, right: 270, bottom: 494 }); fireEvent.scroll(document);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Show me' })).toBeInTheDocument()); expect(screen.getByRole('button', { name: 'Read-only alternative' })).toBeInTheDocument(); view.unmount(); target.remove();
  });
  it('leaves an absent control recoverable and releases its own portal on exit/unmount', async () => {
    const more = vi.fn(), skip = vi.fn(); const view = render(<DeepClaimTutorialOverlay target="missing-control" title="Find the planner" instruction="Open the actual plan." stepLabel="Step 1" onSkip={skip} onExit={noop} onMore={more} />);
    await waitFor(() => expect(document.querySelector('.dct-overlay')).toHaveAttribute('data-target-state', 'missing')); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'More lesson information' })); expect(more).toHaveBeenCalledOnce(); fireEvent.click(screen.getByRole('button', { name: 'Skip explanation' })); expect(skip).toHaveBeenCalledOnce(); view.unmount(); expect(document.querySelector('.dct-overlay')).toBeNull();
  });
});

describe('The full journal and economic-safe practice', () => {
  it('uses all42 lesson definitions, separates reviewed/practiced, filters sections, and pages the complete collection', () => {
    const start = vi.fn(), replay = vi.fn(); render(<DeepClaimTutorialJournal lessons={TUTORIAL_LESSONS} progress={progress()} onStart={start} onReplay={replay} onReview={noop} onClose={noop} />);
    expect(TUTORIAL_LESSONS).toHaveLength(42); expect(screen.getByText(/1\/42 practiced/)).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Resume The Claim' })); expect(start).toHaveBeenCalledWith('beginner.claim');
    fireEvent.change(screen.getByRole('combobox', { name: 'Training section' }), { target: { value: 'workforce' } }); expect(screen.getByText('Reviewed')).toBeInTheDocument(); expect(screen.getByText('Practiced')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Replay Employee Statistics' })); expect(replay).toHaveBeenCalledWith('workforce.stats'); fireEvent.click(screen.getByRole('button', { name: 'Next training page' })); expect(screen.getByRole('heading', { name: 'Durability and Repairs' })).toBeInTheDocument();
  });
  it('presents illustrated reference and explicit review without claiming a transaction was practiced', () => {
    const reviewed = vi.fn(), practiced = vi.fn(); render(<DeepClaimTutorialJournal lessons={TUTORIAL_LESSONS} progress={progress()} onStart={noop} onReplay={noop} onReview={reviewed} onPractice={practiced} onClose={noop} initialLessonId="field.discoveries" />);
    expect(screen.getByRole('heading', { name: 'Rare Discoveries' })).toHaveFocus(); expect(screen.getByText(/six specimen identities/)).toBeInTheDocument(); expect(reviewed).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Mark lesson reviewed' })); expect(reviewed).toHaveBeenCalledWith('field.discoveries'); expect(practiced).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Practice safely' })); expect(practiced).toHaveBeenCalledWith('field.discoveries');
  });
  it('keeps unavailable systems readable, labelled and reachable for safe learning', () => {
    render(<DeepClaimTutorialJournal lessons={TUTORIAL_LESSONS} progress={null} onStart={noop} onReplay={noop} onReview={noop} onClose={noop} availability={{ 'industry.smeltery': 'available_for_practice' }} initialLessonId="industry.smeltery" />); expect(screen.getByText('Safe practice available')).toBeInTheDocument(); expect(screen.getByText(/No unbounded offline queue/)).toBeInTheDocument();
  });
  it('requires a local demo choice before completion and provides feedback without any game action interface', () => {
    const done = vi.fn(); render(<DeepClaimTutorialPractice practice={practice} onReviewed={done} onClose={noop} />); expect(screen.getByText('PRACTICE · NO REAL TRANSACTIONS')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Finish safe practice' })).toBeDisabled(); fireEvent.click(screen.getByRole('button', { name: 'Collect what fits' })); expect(screen.getByRole('status')).toHaveTextContent('The remainder stays staged.'); expect(done).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Finish safe practice' })); expect(done).toHaveBeenCalledOnce();
  });
  it('offers graduation navigation without fictitious rewards or guaranteed profit', () => {
    const resume = vi.fn(), advanced = vi.fn(), guide = vi.fn(); render(<DeepClaimTutorialCompletion onContinue={resume} onAdvanced={advanced} onGuide={guide} reducedMotion />); expect(screen.getByText(/Training grants no extra/)).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Continue Mining' })); fireEvent.click(screen.getByRole('button', { name: 'Explore Advanced Training' })); fireEvent.click(screen.getByRole('button', { name: 'Open Field Guide' })); expect(resume).toHaveBeenCalledOnce(); expect(advanced).toHaveBeenCalledOnce(); expect(guide).toHaveBeenCalledOnce();
  });
  it('labels personalized advice by its visible source and opens its matching lesson', () => {
    const open = vi.fn(); render(<DeepClaimGusAdvice advice={[{ id: 'room', priority: 9, title: 'Make room', text: 'Your warehouse is full.', speaker: 'gus', expression: 'concerned', lesson_id: 'industry.warehouse', open: { type: 'tab', tab: 'stores' }, source: 'public_snapshot' }]} onOpenLesson={open} onOpenJournal={noop} onClose={noop} />); expect(screen.getByText('From your visible company records')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Open related lesson' })); expect(open).toHaveBeenCalledWith('industry.warehouse');
  });
});
