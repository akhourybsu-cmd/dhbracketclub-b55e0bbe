import { describe, expect, it } from 'vitest';
import { DIALOGUES } from '@/lib/mesomon/data/dialogue';
import { REMARKS } from '@/lib/mesomon/data/remarks';
import { readingVoice } from '@/lib/mesomon/reading';

describe('Port Marche dialogue staging', () => {
  it('frames a letter as a document even though its author has a portrait', () => {
    const beats = DIALOGUES.captain.map(line => readingVoice(line.speaker));
    expect(beats.some(beat => beat.kind === 'speech' && beat.portrait)).toBe(true);
    expect(beats).toContainEqual({ kind: 'scene', credit: 'Narration', portrait: null });
    expect(beats).toContainEqual({ kind: 'document', credit: 'Edda’s letter', portrait: null });
  });

  it.each([
    ['captain', 'Edda’s letter', 'Come home. Bring the core. The harbor is singing in two voices.'],
    ['clues-complete', 'Edda’s note', 'The second voice is not echo. Echo follows. This one waits.'],
    ['page', 'Edda’s page', 'Not all doors are opened from the other side.'],
  ])('keeps the original evidence and its written source when reading %s', (scene, speaker, text) => {
    expect(DIALOGUES[scene]).toContainEqual({ speaker, text });
    expect(readingVoice(speaker)).toEqual({ kind: 'document', credit: speaker, portrait: null });
  });

  it('assigns an actual portrait to every speaking role in the chapter and side stories', () => {
    const lines = [...Object.values(DIALOGUES).flat(), ...Object.values(REMARKS).flat().flatMap(variant => variant.lines)];
    for (const speaker of new Set(lines.map(line => line.speaker))) {
      const voice = readingVoice(speaker);
      if (voice.kind === 'speech') expect(voice.portrait, speaker).toBeTruthy();
      else expect(voice.portrait, speaker).toBeNull();
    }
    expect(readingVoice('Field note').kind).toBe('guide');
    expect(readingVoice('Nia’s repair tag').kind).toBe('document');
  });
});
