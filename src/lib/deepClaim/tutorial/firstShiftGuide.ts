import type { DeepClaimSnapshot } from '../types';
import type { TutorialLessonId, TutorialProgress, TutorialStep } from './types';

/** A short route through existing lessons. Optional notes and saved IDs stay intact. */
export const FIRST_SHIFT_GUIDE = [
  { lessonId: 'beginner.plan', stepId: 'beginner.plan.quote', autoAdvance: true },
  { lessonId: 'beginner.descent', stepId: 'beginner.descent.confirmed', autoAdvance: true },
  { lessonId: 'beginner.waiting', stepId: 'beginner.waiting.returned', autoAdvance: true },
  { lessonId: 'beginner.haul', stepId: 'beginner.haul.collected', autoAdvance: true },
  { lessonId: 'beginner.sale', stepId: 'beginner.sale.sale', autoAdvance: true },
  { lessonId: 'beginner.upgrade', stepId: 'beginner.upgrade.review', autoAdvance: false },
] as const;
export type FirstShiftStage = (typeof FIRST_SHIFT_GUIDE)[number];
export const firstShiftStage = (stepId: string | null | undefined) => FIRST_SHIFT_GUIDE.find(stage => stage.stepId === stepId);
export const firstShiftLesson = (id: TutorialLessonId) => FIRST_SHIFT_GUIDE.find(stage => stage.lessonId === id);
function finished(stage: FirstShiftStage, progress: TutorialProgress) {
  return progress.completed_steps.includes(stage.stepId) || progress.reviewed_lessons.includes(stage.lessonId)
    || progress.practiced_lessons.includes(stage.lessonId) || progress.skipped_lessons.includes(stage.lessonId);
}
export function firstShiftResume(progress: TutorialProgress): FirstShiftStage {
  const active = firstShiftStage(progress.active_step_id);
  return active && !finished(active, progress) ? active : FIRST_SHIFT_GUIDE.find(stage => !finished(stage, progress)) ?? FIRST_SHIFT_GUIDE[0];
}
export const isFirstShiftGuideComplete = (progress: TutorialProgress) => FIRST_SHIFT_GUIDE.every(stage => finished(stage, progress));
export function nextFirstShiftStage(stepId: string): FirstShiftStage | null {
  const index = FIRST_SHIFT_GUIDE.findIndex(stage => stage.stepId === stepId);
  return index >= 0 ? FIRST_SHIFT_GUIDE[index + 1] ?? null : null;
}

/** Repair old navigation without changing historical lesson/step identities. */
export function resolveTutorialStep(step: TutorialStep, snapshot: DeepClaimSnapshot | null): TutorialStep {
  if (step.id === 'beginner.plan.quote') return { ...step, target: 'dispatch-review', fallback_targets: ['dispatch-confirm'] };
  if (step.id === 'beginner.upgrade.review') return { ...step,
    open: { type: 'tab', tab: 'surface', view: 'buildings' }, fallback_targets: ['buildings-list', ...(step.fallback_targets ?? [])] };
  if (step.id === 'beginner.graduate.ready') return { ...step, target: 'nav-surface', open: { type: 'tab', tab: 'surface' } };
  if (snapshot?.company && step.id.startsWith('beginner.claim.')) return { ...step, target: 'nav-surface',
    open: { type: 'tab', tab: 'surface' }, instruction: 'Your company is already founded. Continue when you’re ready to plan a shift.' };
  return step;
}
