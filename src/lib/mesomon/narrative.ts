import { REMARKS } from './data/remarks';
import { DIALOGUES } from './data/dialogue';
import type { DialogueLine, MesomonSaveV1 } from './types';

/** Most specific beats come first. Only facts known when the conversation starts count. */
export function narrativeLines(save: MesomonSaveV1, id: string, fallback?: DialogueLine[]): DialogueLine[] {
  const variant = REMARKS[id]?.find(({ when }) =>
    (!when?.tone || save.questFlags.response_tone === when.tone)
    && (when?.all ?? []).every(key => save.questFlags[key] === true)
    && (when?.none ?? []).every(key => save.questFlags[key] !== true));
  return variant?.lines ?? fallback ?? DIALOGUES[id] ?? [];
}
