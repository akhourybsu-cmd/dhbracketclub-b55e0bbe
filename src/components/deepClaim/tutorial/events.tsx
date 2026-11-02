import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { BookOpen } from 'lucide-react';
import type { TutorialEventDetail, TutorialLessonId, TUTORIAL_UI_EVENT_TYPES } from '@/lib/deepClaim/tutorial/types';
import { ClaimButton } from '../DeepClaimPrimitives';

export type TutorialUiEventType = typeof TUTORIAL_UI_EVENT_TYPES[number];
export interface DeepClaimTutorialEvents {
  /** UI observations only. Economic confirmations belong to the authorized Page action path. */
  emit: (type: TutorialUiEventType, detail?: TutorialEventDetail) => void;
  openJournal: (lessonId?: TutorialLessonId) => void;
  askGus: () => void;
  mainMenu?: () => void;
  scopeKey?: string;
  commentaryEnabled?: boolean;
  onCommentaryChange?: (enabled: boolean) => void;
}
interface TutorialBridge extends DeepClaimTutorialEvents { available: boolean }
const noop = () => {};
const TutorialEventsContext = createContext<TutorialBridge>({ emit: noop, openJournal: noop, askGus: noop, available: false });

/** The default keeps independently rendered gameplay and existing component tests functional. */
export function DeepClaimTutorialEventsProvider({ value, children }: { value: DeepClaimTutorialEvents; children: ReactNode }) {
  const current = useRef(value);
  current.current = value;
  const emit = useCallback((type: TutorialUiEventType, detail?: TutorialEventDetail) => current.current.emit(type, detail), []);
  const openJournal = useCallback((lessonId?: TutorialLessonId) => current.current.openJournal(lessonId), []);
  const askGus = useCallback(() => current.current.askGus(), []);
  const mainMenu = useCallback(() => current.current.mainMenu?.(), []);
  const onCommentaryChange = useCallback((enabled: boolean) => current.current.onCommentaryChange?.(enabled), []);
  const canReturn = !!value.mainMenu;
  const canChangeCommentary = !!value.onCommentaryChange;
  const bridge = useMemo<TutorialBridge>(() => ({ available: true, emit, openJournal, askGus,
    mainMenu: canReturn ? mainMenu : undefined, scopeKey: value.scopeKey, commentaryEnabled: value.commentaryEnabled,
    onCommentaryChange: canChangeCommentary ? onCommentaryChange : undefined }),
  [emit, openJournal, askGus, mainMenu, canReturn, value.scopeKey, value.commentaryEnabled, canChangeCommentary, onCommentaryChange]);
  return <TutorialEventsContext.Provider value={bridge}>{children}</TutorialEventsContext.Provider>;
}

// Shared bridge hooks intentionally live with their provider and opt-in help control.
// eslint-disable-next-line react-refresh/only-export-components
export function useDeepClaimTutorialEvents() { return useContext(TutorialEventsContext); }

/** A mounted real view is an observation, never evidence that its transaction succeeded. */
// eslint-disable-next-line react-refresh/only-export-components
export function useTutorialView(type: TutorialUiEventType, detail: TutorialEventDetail | null, identity: string) {
  const { emit, scopeKey } = useDeepClaimTutorialEvents();
  const current = useRef(detail);
  current.current = detail;
  useEffect(() => { if (current.current) emit(type, current.current); }, [emit, scopeKey, type, identity]);
}

export function TutorialHelp({ lessonId, label = 'Help' }: { lessonId: TutorialLessonId; label?: string }) {
  const tutorial = useDeepClaimTutorialEvents();
  if (!tutorial.available) return null;
  return <ClaimButton className="is-small dct-context-help" onClick={() => tutorial.openJournal(lessonId)} aria-label={`Help: ${label}`}>
    <BookOpen size={15} aria-hidden="true" /><span className="dct-help-label">{label}</span>
  </ClaimButton>;
}

/** Shares an existing navigation/profile row; help must not add a row to a bounded panel. */
export function TutorialToolbar({ children, lessonId, label }: { children: ReactNode; lessonId: TutorialLessonId; label: string }) {
  const tutorial = useDeepClaimTutorialEvents();
  if (!tutorial.available) return <>{children}</>;
  return <div className="dct-context-toolbar"><div className="dct-context-content">{children}</div><TutorialHelp lessonId={lessonId} label={label} /></div>;
}
