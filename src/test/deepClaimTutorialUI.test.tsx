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
import { TUTORIAL_LESSON_IDS, TUTORIAL_SECTIONS, type DialogueScene, type TutorialPractice, type TutorialProgress } from '@/lib/deepClaim/tutorial/types';

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
  it('supports an explicit introduction skip and reports controlled conversation progress without advancing itself', () => {
    const advance = vi.fn(), skip = vi.fn();
    const view = render(<DeepClaimTutorialDialogue scene={scene} lineIndex={0} onAdvance={advance} onSkip={skip} skipLabel="Skip introduction" />);
    expect(screen.getByRole('progressbar', { name: 'Conversation progress' })).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('progressbar', { name: 'Conversation progress' })).toHaveAttribute('aria-valuemax', '2');
    fireEvent.click(screen.getByRole('button', { name: 'Skip introduction' })); expect(skip).toHaveBeenCalledOnce(); expect(advance).not.toHaveBeenCalled();
    view.rerender(<DeepClaimTutorialDialogue scene={scene} lineIndex={1} onAdvance={advance} onSkip={skip} skipLabel="Skip introduction" />);
    expect(screen.getByRole('progressbar', { name: 'Conversation progress' })).toHaveAttribute('aria-valuenow', '2');
    expect(screen.getByText('Ready when you are.')).toBeInTheDocument(); expect(advance).not.toHaveBeenCalled();
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
  it('keeps the compact task visible and prioritizes its next action over secondary controls', async () => {
    const target = document.createElement('div'); target.dataset.dcTutorial = 'compact-map'; target.dataset.rect = JSON.stringify({ left: 8, top: 70, width: window.innerWidth - 16, height: window.innerHeight - 174, right: window.innerWidth - 8, bottom: window.innerHeight - 104 }); document.body.append(target);
    const more = vi.fn(); const view = render(<DeepClaimTutorialOverlay target="compact-map" title="Explore your mine" instruction="Use the real map controls." stepLabel="Step 1 of 2" onSkip={noop} onExit={noop} onNext={noop} onMore={more}><button type="button">Show me</button><button type="button">Read-only alternative</button></DeepClaimTutorialOverlay>);
    await waitFor(() => expect(screen.getByRole('region', { name: 'Tutorial guidance' })).toHaveClass('is-compact'));
    expect(screen.queryByRole('button', { name: 'Show me' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Read-only alternative' })).not.toBeInTheDocument(); expect(screen.getByText('Use the real map controls.')).toBeInTheDocument();
    const instruction = screen.getByRole('heading', { name: 'Use the real map controls.' }); expect(instruction).toBeVisible(); expect(instruction.closest('.sr-only')).toBeNull(); instruction.focus(); expect(instruction).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Exit tutorial' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Next tutorial step' })).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'More lesson information' })).not.toBeInTheDocument();
    view.rerender(<DeepClaimTutorialOverlay target="compact-map" title="Explore your mine" instruction="Use the real map controls." stepLabel="Step 1 of 2" onSkip={noop} onExit={noop} onMore={more}><button type="button">Show me</button><button type="button">Read-only alternative</button></DeepClaimTutorialOverlay>);
    fireEvent.click(screen.getByRole('button', { name: 'More lesson information' })); expect(more).toHaveBeenCalledOnce();
    target.dataset.rect = JSON.stringify({ left: 100, top: 450, width: 170, height: 44, right: 270, bottom: 494 }); fireEvent.scroll(document);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Show me' })).toBeInTheDocument()); expect(screen.getByRole('button', { name: 'Read-only alternative' })).toBeInTheDocument(); view.unmount(); target.remove();
  });
  it('keeps the no-sale option explicit and reachable in compact guidance', async () => {
    const target = document.createElement('div'); target.dataset.dcTutorial = 'compact-stock'; target.dataset.rect = JSON.stringify({ left: 8, top: 70, width: window.innerWidth - 16, height: window.innerHeight - 174, right: window.innerWidth - 8, bottom: window.innerHeight - 104 }); document.body.append(target);
    const keep = vi.fn(), exit = vi.fn(); const view = render(<DeepClaimTutorialOverlay target="compact-stock" title="Choose what to keep" instruction="Sell a little coal, or keep it for the next shift." stepLabel="First shift · 5/6" onSkip={noop} onExit={exit} onMore={noop} onKeepMaterials={keep} />);
    await waitFor(() => expect(screen.getByRole('region', { name: 'Tutorial guidance' })).toHaveClass('is-compact'));
    expect(screen.getByRole('heading', { name: 'Sell a little coal, or keep it for the next shift.' })).toBeVisible(); expect(keep).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'More lesson information' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Next tutorial step' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep materials' })); expect(keep).toHaveBeenCalledOnce(); expect(exit).not.toHaveBeenCalled(); view.unmount(); target.remove();
  });
  it('leaves an absent control recoverable and releases its own portal on exit/unmount', async () => {
    const more = vi.fn(), skip = vi.fn(); const view = render(<DeepClaimTutorialOverlay target="missing-control" title="Find the planner" instruction="Open the actual plan." stepLabel="Step 1" onSkip={skip} onExit={noop} onMore={more} />);
    await waitFor(() => expect(document.querySelector('.dct-overlay')).toHaveAttribute('data-target-state', 'missing')); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'More lesson information' })); expect(more).toHaveBeenCalledOnce(); fireEvent.click(screen.getByRole('button', { name: 'Skip lesson' })); expect(skip).toHaveBeenCalledOnce(); view.unmount(); expect(document.querySelector('.dct-overlay')).toBeNull();
  });
});

describe('The full journal and economic-safe practice', () => {
  it('keeps all42 optional topics browsable without presenting them as a mandatory course', () => {
    const start = vi.fn(), replay = vi.fn(), review = vi.fn();
    render(<DeepClaimTutorialJournal lessons={TUTORIAL_LESSONS} progress={progress()} onStart={start} onReplay={replay} onReview={review} onClose={noop} />);
    expect(TUTORIAL_LESSONS).toHaveLength(42); expect(screen.queryByText(/\/42 practiced/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start guided first shift' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Training section' }), { target: { value: 'workforce' } });
    expect(screen.getByText('Reviewed')).toBeInTheDocument(); expect(screen.getByText('Done in your company')).toBeInTheDocument();
    const seen = new Set<string>();
    for (const section of TUTORIAL_SECTIONS) {
      fireEvent.change(screen.getByRole('combobox', { name: 'Training section' }), { target: { value: section } });
      for (let page = 0; page < TUTORIAL_LESSONS.length; page++) {
        for (const card of document.querySelectorAll<HTMLElement>('[data-journal-lesson]')) {
          seen.add(card.dataset.journalLesson!); expect(within(card).getAllByRole('button')).toHaveLength(1);
          expect(within(card).getByRole('button', { name: /^Open / })).toBeInTheDocument();
        }
        const next = screen.getByRole('button', { name: 'Next training page' }) as HTMLButtonElement;
        if (next.disabled) break;
        fireEvent.click(next);
      }
    }
    expect([...seen].sort()).toEqual([...TUTORIAL_LESSON_IDS].sort());
    expect(start).not.toHaveBeenCalled(); expect(replay).not.toHaveBeenCalled(); expect(review).not.toHaveBeenCalled();
  });
  it('starts the short guide and resumes its own next stage even when an optional topic was last active', () => {
    const start = vi.fn(), replay = vi.fn(); const saved = progress();
    const view = render(<DeepClaimTutorialJournal lessons={TUTORIAL_LESSONS} progress={saved} onStart={start} onReplay={replay} onReview={noop} onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided first shift' })); expect(start).toHaveBeenLastCalledWith('beginner.plan');
    saved.completed_steps = ['beginner.plan.quote']; saved.active_lesson_id = 'workforce.hiring'; saved.active_step_id = TUTORIAL_LESSONS.find(lesson => lesson.id === 'workforce.hiring')!.steps[0].id;
    view.rerender(<DeepClaimTutorialJournal lessons={TUTORIAL_LESSONS} progress={saved} onStart={start} onReplay={replay} onReview={noop} onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Resume guided first shift' })); expect(start).toHaveBeenLastCalledWith('beginner.descent'); expect(replay).not.toHaveBeenCalled();
  });
  it('opens a topic without starting it, then starts its real walkthrough only on explicit request', () => {
    const start = vi.fn(), replay = vi.fn(), review = vi.fn(); const lesson = TUTORIAL_LESSONS.find(item => item.id === 'workforce.stats')!;
    render(<DeepClaimTutorialJournal lessons={TUTORIAL_LESSONS} progress={progress()} onStart={start} onReplay={replay} onReview={review} onClose={noop} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Training section' }), { target: { value: 'workforce' } });
    fireEvent.click(screen.getByRole('button', { name: `Open ${lesson.title}` }));
    expect(screen.getByRole('heading', { name: lesson.title })).toHaveFocus(); expect(start).not.toHaveBeenCalled(); expect(replay).not.toHaveBeenCalled(); expect(review).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Start lesson' })); expect(start).toHaveBeenCalledWith(lesson.id); expect(replay).not.toHaveBeenCalled();
  });
  it('presents illustrated notes and examples without claiming a company action was practiced', () => {
    const reviewed = vi.fn(), practiced = vi.fn(), start = vi.fn(); const lesson = TUTORIAL_LESSONS.find(item => item.id === 'field.discoveries')!;
    render(<DeepClaimTutorialJournal lessons={TUTORIAL_LESSONS} progress={progress()} onStart={start} onReplay={noop} onReview={reviewed} onPractice={practiced} onClose={noop} initialLessonId={lesson.id} />);
    expect(screen.getByRole('heading', { name: lesson.title })).toHaveFocus();
    const notes = screen.getByText('Field notes').closest('summary')!; fireEvent.click(notes);
    expect(within(notes.closest('details')!).getByText(lesson.reference[0])).toBeVisible(); expect(reviewed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Mark lesson reviewed' })); expect(reviewed).toHaveBeenCalledWith(lesson.id); expect(practiced).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Try an example').closest('summary')!); fireEvent.click(screen.getByRole('button', { name: 'View example' })); expect(practiced).toHaveBeenCalledWith(lesson.id); expect(start).not.toHaveBeenCalled();
  });
  it('keeps complete notes and task instructions in explicit disclosures without duplicating or recording a lesson', () => {
    const reviewed = vi.fn(), practiced = vi.fn(), base = TUTORIAL_LESSONS.find(item => item.id === 'club.privacy') ?? TUTORIAL_LESSONS[0];
    const lesson = { ...base, summary: 'A single field note.', reference: ['A single field note.', 'Another complete field note.'] };
    render(<DeepClaimTutorialJournal lessons={[lesson]} progress={progress()} onStart={noop} onReplay={noop} onReview={reviewed} onPractice={practiced} onClose={noop} initialLessonId={lesson.id} />);
    const notes = screen.getByText('Field notes').closest('summary')!, notesDetail = notes.closest('details')!;
    const route = screen.getByText('Lesson route').closest('summary')!, routeDetail = route.closest('details')!;
    expect(notesDetail.open).toBe(false); expect(routeDetail.open).toBe(false); expect(screen.getAllByText('A single field note.')).toHaveLength(1);
    fireEvent.click(notes); expect(notesDetail.open).toBe(true); expect(screen.getByText('Another complete field note.')).toBeVisible();
    fireEvent.click(route); expect(routeDetail.open).toBe(true); expect(within(routeDetail).getByText(lesson.steps[0].instruction)).toBeVisible();
    expect(reviewed).not.toHaveBeenCalled(); expect(practiced).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Mark lesson reviewed' })); expect(reviewed).toHaveBeenCalledWith(lesson.id);
    expect(screen.getByRole('button', { name: 'Mark lesson reviewed' })).toHaveTextContent('Mark lesson reviewed');
  });
  it('keeps unavailable systems readable and sends its primary action to an example, never the live company', () => {
    const start = vi.fn(), example = vi.fn(); const lesson = TUTORIAL_LESSONS.find(item => item.id === 'industry.smeltery')!;
    render(<DeepClaimTutorialJournal lessons={TUTORIAL_LESSONS} progress={null} onStart={start} onReplay={example} onReview={noop} onClose={noop} availability={{ 'industry.smeltery': 'available_for_practice' }} initialLessonId={lesson.id} />);
    expect(screen.getByText('Example available')).toBeInTheDocument(); const notes = screen.getByText('Field notes').closest('summary')!; fireEvent.click(notes);
    expect(within(notes.closest('details')!).getByText(lesson.reference[0])).toBeVisible(); fireEvent.click(screen.getByRole('button', { name: 'View example' })); expect(example).toHaveBeenCalledWith(lesson.id); expect(start).not.toHaveBeenCalled();
  });
  it('requires a local demo choice before completion and provides feedback without any game action interface', () => {
    const done = vi.fn(); render(<DeepClaimTutorialPractice practice={practice} onReviewed={done} onClose={noop} />); expect(screen.getByText('EXAMPLE · NO COST')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Finish example' })).toBeDisabled(); fireEvent.click(screen.getByRole('button', { name: 'Collect what fits' })); expect(screen.getByRole('status')).toHaveTextContent('The remainder stays staged.'); expect(done).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Finish example' })); expect(done).toHaveBeenCalledOnce();
  });
  it('shows immediate choice feedback while leaving extra advice explicitly expandable and completion deliberate', () => {
    const done = vi.fn(); render(<DeepClaimTutorialPractice practice={practice} onReviewed={done} onClose={noop} />);
    const choice = screen.getByRole('button', { name: 'Collect what fits' }); fireEvent.click(choice);
    expect(choice).toHaveAttribute('aria-pressed', 'true'); expect(screen.getByRole('status')).toHaveTextContent('The remainder stays staged.');
    const advice = screen.getByText('Gus’s advice').closest('summary')!, details = advice.closest('details')!;
    expect(details.open).toBe(false); fireEvent.click(advice); expect(details.open).toBe(true);
    expect(screen.getByText(practice.takeaway)).toBeVisible(); expect(done).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Finish example' })); expect(done).toHaveBeenCalledOnce();
  });
  it('offers graduation navigation without fictitious rewards or guaranteed profit', () => {
    const resume = vi.fn(), advanced = vi.fn(), guide = vi.fn(); render(<DeepClaimTutorialCompletion onContinue={resume} onAdvanced={advanced} onGuide={guide} reducedMotion />); expect(screen.getByRole('region', { name: 'First shift guide complete' })).toBeInTheDocument(); expect(screen.queryByText(/profit|mule|bonus credits/i)).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Continue Mining' })); fireEvent.click(screen.getByRole('button', { name: 'Explore Advanced Training' })); fireEvent.click(screen.getByRole('button', { name: 'Open Field Guide' })); expect(resume).toHaveBeenCalledOnce(); expect(advanced).toHaveBeenCalledOnce(); expect(guide).toHaveBeenCalledOnce();
  });
  it('labels personalized advice by its visible source and opens its matching lesson', () => {
    const open = vi.fn(); render(<DeepClaimGusAdvice advice={[{ id: 'room', priority: 9, title: 'Make room', text: 'Your warehouse is full.', speaker: 'gus', expression: 'concerned', lesson_id: 'industry.warehouse', open: { type: 'tab', tab: 'stores' }, source: 'public_snapshot' }]} onOpenLesson={open} onOpenJournal={noop} onClose={noop} />); expect(screen.getByText('From your claim')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Open related lesson' })); expect(open).toHaveBeenCalledWith('industry.warehouse');
  });
});
