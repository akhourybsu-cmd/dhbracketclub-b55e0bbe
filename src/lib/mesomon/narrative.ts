import { REMARKS } from './data/remarks';
import { DIALOGUES } from './data/dialogue';
import type { DialogueLine, MesomonSaveV1 } from './types';

/** Called when opening a conversation. Its lines and any one-time discovery are saved together. */
export function beginNarrativeBeat(save: MesomonSaveV1, id: string): DialogueLine[] {
  const variant = REMARKS[id]?.find(({ once, when }) =>
    (!once || save.questFlags[`heard:${once}`] !== true)
    && (!when?.tone || save.questFlags.response_tone === when.tone)
    && (when?.all ?? []).every(key => save.questFlags[key] === true)
    && (when?.none ?? []).every(key => save.questFlags[key] !== true));
  if (variant?.once) save.questFlags[`heard:${variant.once}`] = true;
  return variant?.lines ?? DIALOGUES[id] ?? [];
}
