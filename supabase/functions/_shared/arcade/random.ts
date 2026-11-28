/** FNV-1a string fold and xorshift32 stream. The seed belongs to a single run. */
export function seedWord(seed: string) {
  let word = 2166136261;
  for (let i = 0; i < seed.length; i++) word = Math.imul(word ^ seed.charCodeAt(i), 16777619);
  return word >>> 0 || 1;
}

export function nextWord(word: number) {
  word ^= word << 13;
  word ^= word >>> 17;
  word ^= word << 5;
  return word >>> 0;
}
