import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Crosshair } from 'lucide-react';
import type { DeepClaimSnapshot } from '@/lib/deepClaim/types';
import type { DeepClaimAudio } from '@/lib/deepClaim/audio';
import { BEGINNER_LESSONS, getTutorialLesson, TUTORIAL_LESSONS } from '@/lib/deepClaim/tutorial/chapters';
import { evaluateTutorialStep, hasVerifiedSale, isLessonPracticed, lessonAvailability } from '@/lib/deepClaim/tutorial/completion';
import { getDialogueHistory, getDialogueScene } from '@/lib/deepClaim/tutorial/dialogue';
import { applyTutorialPatch, getTutorialLessonStatus, isFirstDescentComplete } from '@/lib/deepClaim/tutorial/progress';
import { getTutorialPractice } from '@/lib/deepClaim/tutorial/practice';
import { getGusAdvice } from '@/lib/deepClaim/tutorial/advice';
import type { TutorialContext, TutorialEvent, TutorialLessonId, TutorialOpenAction, TutorialProgress, TutorialProgressPatch, TutorialScope } from '@/lib/deepClaim/tutorial/types';
import { ClaimDialog } from '../DeepClaimPrimitives';
import { DeepClaimTutorialDialogue } from './DeepClaimTutorialDialogue';
import { DeepClaimTutorialOverlay } from './DeepClaimTutorialOverlay';
import { DeepClaimTutorialJournal } from './DeepClaimTutorialJournal';
import { DeepClaimTutorialPractice } from './DeepClaimTutorialPractice';
import { DeepClaimTutorialCompletion } from './DeepClaimTutorialCompletion';
import { DeepClaimGusAdvice } from './DeepClaimGusAdvice';
import './director.css';

export interface DeepClaimTrainingRequest { id: string; kind: 'journal' | 'lesson' | 'replay' | 'advice' | 'welcome'; lessonId?: TutorialLessonId }
export interface DeepClaimTutorialDirectorProps {
  snapshot: DeepClaimSnapshot | null; scope: TutorialScope; progress: TutorialProgress; events: readonly TutorialEvent[];
  update: (patch: TutorialProgressPatch) => void; request: DeepClaimTrainingRequest | null; active: boolean; reducedMotion: boolean;
  navigate: (action: TutorialOpenAction) => void; onModalChange: (open: boolean) => void; audio: DeepClaimAudio;
  saving?: boolean; error?: string | null; onRetry: () => void; onContinue: () => void;
}

/** The director observes real views and confirmed snapshots. Navigation never purchases anything. */
export function DeepClaimTutorialDirector(props: DeepClaimTutorialDirectorProps) {
  const { progress, snapshot, update } = props;
  const [pane, setPane] = useState<'journal' | 'practice' | 'advice' | 'graduation' | null>(null);
  const [referenceId, setReferenceId] = useState<TutorialLessonId | null>(null);
  const [practiceId, setPracticeId] = useState<TutorialLessonId | null>(null);
  const [practiceAdvances, setPracticeAdvances] = useState(false);
  const [sceneOverride, setSceneOverride] = useState<string | null>(null);
  const [lineIndex, setLineIndex] = useState(0);
  const handled = useRef<string | null>(null);
  const navigated = useRef<string | null>(null);
  const context: TutorialContext = { snapshot, scope: props.scope, progress, events: props.events };
  const current = getTutorialLesson(progress.active_lesson_id ?? '');
  const index = Math.max(0, current?.steps.findIndex(step => step.id === progress.active_step_id) ?? 0);
  const step = current?.steps[index];
  const running = props.active && progress.campaign_status === 'active' && !!current;
  const result = step ? evaluateTutorialStep(step, context) : null;
  const already = !!step && progress.completed_steps.includes(step.id);
  const introduction = running && current ? getDialogueScene(current.intro_scene_id, context) : null;
  const introUnseen = progress.commentary_enabled && introduction?.lines.some(line => !progress.seen_dialogue.includes(line.id));
  const scene = sceneOverride && progress.commentary_enabled ? getDialogueScene(sceneOverride, context) : introUnseen ? introduction : null;
  const sceneId = scene?.id;
  const sceneRef = useRef(scene); sceneRef.current = scene;
  const history = useMemo(() => getDialogueHistory(progress.seen_dialogue), [progress.seen_dialogue]);
  const callbacks = useRef(props); callbacks.current = props;
  const availability = Object.fromEntries(TUTORIAL_LESSONS.map(lesson => [lesson.id, getTutorialLessonStatus(lesson.id, progress, snapshot)]));

  function start(id: TutorialLessonId) {
    const lesson = getTutorialLesson(id); if (!lesson) return;
    if (id === 'beginner.claim' && !snapshot?.company) { setPane(null); props.navigate({ type: 'found_company' }); return; }
    if (!lessonAvailability(id, snapshot).live) { setPracticeId(id); setPracticeAdvances(false); setPane('practice'); return; }
    setPane(null); setReferenceId(id); setSceneOverride(null); navigated.current = null;
    props.onContinue();
    const resume = progress.active_lesson_id === id && lesson.steps.some(item => item.id === progress.active_step_id);
    update({ active_lesson_id: id, active_step_id: resume ? progress.active_step_id : lesson.steps[0].id, campaign_status: 'active' });
    props.navigate(lesson.steps[resume ? Math.max(0, lesson.steps.findIndex(item => item.id === progress.active_step_id)) : 0].open ?? { type: 'tab', tab: 'surface' });
  }
  useEffect(() => {
    const request = props.request; if (!request || request.id === handled.current) return;
    if (request.kind === 'welcome' && !snapshot?.company) return;
    handled.current = request.id;
    if (request.kind === 'journal') { setReferenceId(request.lessonId ?? null); setPane('journal'); }
    else if (request.kind === 'advice') setPane('advice');
    else if (request.kind === 'replay') { setPracticeId(request.lessonId ?? 'beginner.claim'); setPracticeAdvances(false); setPane('practice'); }
    else if (request.kind === 'welcome') {
      setPane(null); setSceneOverride('opening.crew');
      update({ active_lesson_id: 'beginner.claim', active_step_id: BEGINNER_LESSONS[0].steps[0].id, campaign_status: 'active', seen_dialogue: getDialogueScene('opening.deed')?.lines.map(line => line.id) ?? [] });
    } else if (request.lessonId) start(request.lessonId);
  // A request is an explicit command, not an effect replay on every saved note.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.request?.id, props.scope.company_id]);
  useEffect(() => {
    const value = sceneRef.current;
    if (!value) { setLineIndex(0); return; }
    const firstUnread = value.lines.findIndex(line => !callbacks.current.progress.seen_dialogue.includes(line.id));
    setLineIndex(Math.max(0, firstUnread));
  }, [sceneId]);
  useEffect(() => {
    if (!running || pane || sceneId || !step?.open) return;
    const key = `${props.scope.company_id}:${step.id}`;
    if (navigated.current === key) return;
    navigated.current = key; callbacks.current.navigate(step.open);
  }, [running, pane, sceneId, step?.id, step?.open, props.scope.company_id]);
  const modalOpen = !!pane || !!sceneId && props.active;
  const onModalChange = props.onModalChange;
  useEffect(() => { onModalChange(modalOpen); return () => onModalChange(false); }, [modalOpen, onModalChange]);
  useEffect(() => {
    if (progress.commentary_enabled || !sceneOverride) return;
    if (sceneOverride.startsWith('graduation.')) setPane('graduation');
    setSceneOverride(null);
  }, [progress.commentary_enabled, sceneOverride]);
  useEffect(() => {
    // Returning to the menu legitimately removes the live guide. Record that
    // observed navigation without reopening Settings or inventing a transaction.
    if (props.active || current?.id !== 'settings.main_menu' || !step || !result?.complete || progress.completed_steps.includes(step.id)) return;
    callbacks.current.update({ completed_steps: [step.id], reviewed_lessons: [current.id], practiced_lessons: [current.id], active_lesson_id: null, active_step_id: null, campaign_status: 'paused' });
  }, [props.active, current, step, result?.complete, progress.completed_steps]);

  function finishLesson(reviewed: boolean, extra: TutorialProgressPatch = {}) {
    if (!current) return;
    const patch: TutorialProgressPatch = { ...extra,
      ...(reviewed ? { reviewed_lessons: [current.id], ...(isLessonPracticed(current, context) ? { practiced_lessons: [current.id] } : {}) } : { skipped_lessons: [current.id] }) };
    const next = current.section === 'beginner' ? BEGINNER_LESSONS.find(lesson => lesson.order === current.order + 1) : null;
    if (next) {
      update({ ...patch, active_lesson_id: next.id, active_step_id: next.steps[0].id, campaign_status: 'active' });
      navigated.current = null; props.audio.play('tutorial_chapter'); return;
    }
    const projected = applyTutorialPatch(progress, patch);
    const graduate = current.section === 'beginner' && isFirstDescentComplete(projected);
    update({ ...patch, active_lesson_id: null, active_step_id: null, campaign_status: graduate ? 'completed' : 'paused' });
    if (graduate) { setSceneOverride(hasVerifiedSale(context) ? 'graduation.sale' : 'graduation.review'); props.audio.play('tutorial_chapter'); }
    else { setReferenceId(current.id); setPane('journal'); }
  }
  function next() {
    if (!current || !step || !(already || result?.complete)) return;
    props.audio.play('tutorial_step');
    const nextStep = current.steps[index + 1];
    if (nextStep) update({ completed_steps: [step.id], active_lesson_id: current.id, active_step_id: nextStep.id });
    else finishLesson(true, { completed_steps: [step.id] });
  }
  function pause() { setPane(null); setSceneOverride(null); update({ campaign_status: 'paused' }); props.audio.play('menu_back'); }
  function endDialogue(skip = false) {
    if (!scene) return;
    const line = scene.lines[Math.min(lineIndex, scene.lines.length - 1)];
    const finished = skip || lineIndex >= scene.lines.length - 1;
    const seen = finished ? scene.lines.map(item => item.id) : [line.id];
    if (scene.id === 'opening.crew' && finished) seen.push(...(getDialogueScene('chapter.beginner.claim', context)?.lines.map(item => item.id) ?? []));
    update({ seen_dialogue: seen }); props.audio.play('menu_select');
    if (!finished) { setLineIndex(value => value + 1); return; }
    if (scene.id.startsWith('graduation.')) setPane('graduation');
    setSceneOverride(null);
  }
  const practiceLesson = getTutorialLesson(practiceId ?? '');
  const practice = practiceLesson ? getTutorialPractice(practiceLesson, snapshot) : null;
  const libraryTitle = pane === 'journal' ? 'Prospector’s Training Journal' : pane === 'practice' ? 'Read-only training practice' : pane === 'advice' ? 'Ask Gus' : 'The First Descent complete';
  return <>
    <ClaimDialog open={!!pane} onClose={() => setPane(null)} title={libraryTitle} description="Company-scoped training. Learning never spends or awards company resources." className="dct-library-dialog">
      {pane === 'journal' && <DeepClaimTutorialJournal key={referenceId ?? 'library'} lessons={TUTORIAL_LESSONS} progress={progress} snapshot={snapshot} availability={availability} initialLessonId={referenceId} onStart={start}
        onReplay={id => { setPracticeId(id); setPracticeAdvances(false); setPane('practice'); }}
        onPractice={id => { setPracticeId(id); setPracticeAdvances(false); setPane('practice'); }}
        onReview={id => update({ reviewed_lessons: [id] })} onClose={() => setPane(null)} error={props.error} onRetry={props.onRetry} />}
      {pane === 'practice' && practice && <DeepClaimTutorialPractice key={practice.id} practice={practice} lesson={practiceLesson!} snapshot={snapshot}
        onReviewed={() => { update({ reviewed_lessons: [practice.lesson_id] }); if (practiceAdvances && current?.id === practice.lesson_id) { setPane(null); finishLesson(true); } else { setReferenceId(practice.lesson_id); setPane('journal'); } }}
        onClose={() => { setReferenceId(practice.lesson_id); setPane(practiceAdvances ? null : 'journal'); }} />}
      {pane === 'advice' && <DeepClaimGusAdvice advice={getGusAdvice(snapshot)} onOpenLesson={id => { setReferenceId(id); setPane('journal'); }} onOpenJournal={() => { setReferenceId(null); setPane('journal'); }} onClose={() => setPane(null)} />}
      {pane === 'graduation' && <DeepClaimTutorialCompletion reducedMotion={props.reducedMotion} onContinue={() => { setPane(null); props.onContinue(); }} onAdvanced={() => { setReferenceId('workforce.hiring'); setPane('journal'); }} onGuide={() => { setReferenceId(null); setPane('journal'); }} />}
    </ClaimDialog>
    <ClaimDialog open={!!scene && !pane && props.active} onClose={() => endDialogue(true)} title={scene?.title ?? 'Camp conversation'} description="Advance at your own pace, or skip the conversation." className="dct-dialogue-dialog">
      {scene && <DeepClaimTutorialDialogue scene={scene} lineIndex={lineIndex} history={history} onAdvance={() => endDialogue()} onBack={lineIndex > 0 ? () => setLineIndex(value => Math.max(0, value - 1)) : undefined} onSkip={() => endDialogue(true)} reducedMotion={props.reducedMotion} />}
    </ClaimDialog>
    {running && current && step && !pane && !scene && <DeepClaimTutorialOverlay target={step.target} fallbackTargets={step.fallback_targets} title={step.title} instruction={step.instruction}
      stepLabel={`${current.title} · ${index + 1}/${current.steps.length}`} lessonId={current.id} stepId={step.id} reducedMotion={props.reducedMotion}
      onBack={index > 0 ? () => update({ active_lesson_id: current.id, active_step_id: current.steps[index - 1].id }) : undefined}
      onNext={already || result?.complete ? next : undefined} onExit={pause} onSkip={() => finishLesson(false)}
      onMore={() => { setReferenceId(current.id); setPane('journal'); }}>
      <p role="status" className="dct-step-status" data-complete={already || !!result?.complete}>{already || result?.complete ? <Check size={13} aria-hidden="true" /> : <Crosshair size={13} aria-hidden="true" />}<span>{already ? 'Recorded' : result?.complete ? 'Ready' : 'Your move'}</span><span className="sr-only">{already ? 'Previously confirmed for this company.' : result?.explanation}</span></p>
      <div className="dct-director-actions">{step.open && <button className="dct-button" type="button" onClick={() => props.navigate(step.open!)}>Show me</button>}
        <button className="dct-button" type="button" onClick={() => { setPracticeId(current.id); setPracticeAdvances(true); setPane('practice'); }}>Read-only alternative</button></div>
      {props.error && <p className="dct-sync-note">Journal sync pending. Your mine keeps working.</p>}
    </DeepClaimTutorialOverlay>}
  </>;
}
