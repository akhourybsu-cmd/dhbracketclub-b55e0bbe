import { dialoguePortrait } from './assets';

// Existing saves store the source of each line. Use the same credit in the
// scene and the journal, even when reopening a conversation from an older file.
const WRITTEN_SOURCES = new Set([
  'Edda’s letter', 'Edda’s note', 'Edda’s page', 'Harbor board',
  'Nia’s repair tag', 'Maintenance marks',
]);

export function readingVoice(speaker: string) {
  if (speaker === 'Port Marche') return { kind: 'scene', credit: 'Narration', portrait: null } as const;
  if (speaker === 'Field note') return { kind: 'guide', credit: speaker, portrait: null } as const;
  if (WRITTEN_SOURCES.has(speaker)) return { kind: 'document', credit: speaker, portrait: null } as const;
  return { kind: 'speech', credit: speaker, portrait: dialoguePortrait(speaker) } as const;
}
