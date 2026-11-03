import { describe, expect, it } from 'vitest';
import { getTutorialLesson, getTutorialStep } from '@/lib/deepClaim/tutorial/chapters';
import { getDialogueScene } from '@/lib/deepClaim/tutorial/dialogue';
import { getTutorialPractice } from '@/lib/deepClaim/tutorial/practice';
import { getGusAdvice } from '@/lib/deepClaim/tutorial/advice';
import { companySnapshot } from './fixtures/deepClaim';

describe('Deep Claim clear operation guidance', () => {
  it('introduces the two mining choices using the same action names as the planner', () => {
    const lesson = getTutorialLesson('beginner.worksite')!;
    const text = lesson.reference.join(' ');
    expect(text).toContain('Mine a deposit');
    expect(text).toContain('Expand tunnels');
    expect(text).toMatch(/known seam/);
    expect(text).toMatch(/digs new routes/);
    expect(lesson.steps[0].instruction).toContain('Mine a deposit');
    expect(lesson.steps[0].instruction).toContain('First shift');
    const scene = getDialogueScene('chapter.beginner.worksite')!;
    expect(scene.lines).toHaveLength(1);
    expect(scene.lines[0]).toMatchObject({ id: 'chapter.beginner.worksite.01', speaker: 'mara' });
    expect(scene.lines[0].text).toContain('Mine a deposit');
    expect(scene.lines[0].text).toContain('Expand tunnels');
  });

  it('distinguishes persistent excavation from optional map-only scouting without promising cargo', () => {
    const dig = getTutorialLesson('field.exploration')!;
    const scout = getTutorialLesson('field.survey')!;
    expect(dig.title).toBe('Expand tunnels');
    expect(dig.reference.join(' ')).toMatch(/tunnels stay open/);
    expect(dig.reference.join(' ')).toMatch(/without an ore haul/);
    expect(scout.title).toBe('Scout the area');
    const text = scout.reference.join(' ');
    expect(text).toMatch(/does not dig tunnels or remove deposits/);
    expect(text).toMatch(/optional, costs wages and energy/);
    expect(text).toMatch(/no ore or specimens/);
    const practice = getTutorialPractice('field.survey')!;
    expect(practice.facts).toContainEqual({ label: 'Cargo', value: 'No ore or specimens' });
    expect(practice.choices.find(choice => !choice.recommended)?.feedback).toContain('Revealed rock stays in place');
    expect(practice.readonly).toBe(true);
  });

  it('explains paid local improvements and rail as more work within the same return schedule', () => {
    const lesson = getTutorialLesson('field.infrastructure')!;
    expect(lesson.title).toBe('Improve the mine');
    const text = lesson.reference.join(' ');
    expect(text).toMatch(/crew, materials and a fee/);
    expect(text).toMatch(/finished structures help future shifts in their coverage area/);
    expect(text).toMatch(/more time to work within the same shift/);
    expect(text).toMatch(/does not bring the return timer forward/);
    const practice = getTutorialPractice('field.infrastructure')!;
    expect(practice.choices.find(choice => !choice.recommended)?.feedback).toContain('The return timer does not change');
    expect(getTutorialLesson('field.hazards')!.reference.join(' ')).toContain('do not kill workers, destroy cargo or take extra energy');
  });

  it('retains saved tutorial identities, canonical mode IDs, and completion predicates', () => {
    const routes = [
      ['beginner.worksite.difference', 'extract', 'dispatch-mode', { kind: 'acknowledge' }],
      ['field.exploration.frontier', 'explore', 'dispatch-mode', { kind: 'event', type: 'dispatch_opened', detail: { mode: 'explore' } }],
      ['field.survey.survey', 'survey', 'dispatch-mode', { kind: 'event', type: 'dispatch_opened', detail: { mode: 'survey' } }],
      ['field.infrastructure.project', 'infrastructure', 'field-infrastructure', { kind: 'event', type: 'dispatch_opened', detail: { mode: 'infrastructure' } }],
    ] as const;
    for (const [id, mode, target, predicate] of routes) {
      expect(getTutorialStep(id)).toMatchObject({ id, target, open: { type: 'dispatch', mode }, predicate });
    }
    expect(getTutorialLesson('field.exploration')!.practice_predicate).toEqual({ kind: 'event', type: 'expedition_confirmed', detail: { mode: 'explore' } });
    expect(getTutorialLesson('field.survey')!.practice_predicate).toEqual({ kind: 'snapshot', fact: 'survey_completed' });
    expect(getTutorialLesson('field.infrastructure')!.practice_predicate).toEqual({ kind: 'snapshot', fact: 'infrastructure_installed' });
  });

  it('keeps Gus’s next-shift advice concise and treats support work as optional', () => {
    const snapshot = companySnapshot(), original = structuredClone(snapshot);
    const advice = getGusAdvice(snapshot).find(item => item.id === 'next_decision')!;
    expect(advice.text).toContain('Mine a deposit');
    expect(advice.text).toContain('Expand tunnels');
    expect(advice.text).toContain('Scout the area and Improve the mine can wait');
    expect(advice.text.split(/\s+/).length).toBeLessThanOrEqual(35);
    expect(advice.open).toEqual({ type: 'journal', lesson_id: 'business.strategy' });
    expect(snapshot).toEqual(original);
  });
});
