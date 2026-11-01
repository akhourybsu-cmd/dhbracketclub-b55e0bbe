import { describe, expect, it, vi } from 'vitest';
import { CipherSetupSession, validateCipherDraft } from '@/lib/showdown/cipher/setup';
import type { CipherDraft } from '@/lib/showdown/cipher/types';
import { CIPHER_CODE_A, CIPHER_CODE_B } from './fixtures/cipher';

class DeviceStore {
  values = new Map<string, string>();
  getItem = (key: string) => this.values.get(key) ?? null;
  setItem = (key: string, value: string) => { this.values.set(key, value); };
  removeItem = (key: string) => { this.values.delete(key); };
}
const blanks: CipherDraft = [null,null,null,null];

describe('Cipher creator setup and durable lock intent', () => {
  it('keeps nullable drafts locally without issuing a request identity until explicit preparation', () => {
    const store = new DeviceStore(), session = new CipherSetupSession('member-a:club-1:rival-b:new', store);
    const identity = vi.spyOn(crypto, 'randomUUID');
    try {
      session.changeDraft(['red',null,'blue',null]);
      expect(session.getSnapshot()).toEqual({ draft: ['red',null,'blue',null], pendingCode: null });
      expect(identity).not.toHaveBeenCalled();
      expect(JSON.parse(store.getItem('member-a:club-1:rival-b:new')!).pending).toBeNull();
      expect(new CipherSetupSession('member-a:club-1:rival-b:new', store).getSnapshot().draft).toEqual(['red',null,'blue',null]);
    } finally { identity.mockRestore(); }
  });
  it('freezes an exact prepared code and UUID across reload, ignoring edits and rejecting replacement', () => {
    const store = new DeviceStore(), session = new CipherSetupSession('setup', store);
    const prepared = session.prepare(CIPHER_CODE_A);
    expect(prepared.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    session.changeDraft(CIPHER_CODE_B);
    expect(session.getSnapshot().draft).toEqual(CIPHER_CODE_A);
    expect(() => session.prepare(CIPHER_CODE_B)).toThrow(/same code/);
    expect(new CipherSetupSession('setup', store).prepare(CIPHER_CODE_A)).toEqual(prepared);
    expect(JSON.stringify(session.getSnapshot())).not.toMatch(/opponent|result|feedback/);
  });
  it('isolates drafts and pending locks by user, club, opponent and rematch scope', () => {
    const store = new DeviceStore();
    const first = new CipherSetupSession('a:club-1:b:new', store); first.prepare(CIPHER_CODE_A);
    const scopes = ['c:club-1:b:new','a:club-2:b:new','a:club-1:c:new','a:club-1:b:old-match'];
    for (const scope of scopes) expect(new CipherSetupSession(scope, store).getSnapshot()).toEqual({ draft: blanks, pendingCode: null });
    const other = new CipherSetupSession(scopes[0], store); other.changeDraft(['purple',null,null,'orange']);
    first.complete();
    expect(store.getItem('a:club-1:b:new')).toBeNull();
    expect(new CipherSetupSession(scopes[0], store).getSnapshot().draft).toEqual(['purple',null,null,'orange']);
  });
  it('rejects malformed drafts including sparse arrays and refuses an incomplete lock', () => {
    for (const invalid of [[], Array(4), ['red',null,null], ['red','blue','green','cyan'], ['red',undefined,null,null]]) expect(() => validateCipherDraft(invalid)).toThrow();
    const store = new DeviceStore(), session = new CipherSetupSession('setup', store);
    expect(() => session.prepare(['red',null,null,null] as never)).toThrow();
    expect(session.getSnapshot()).toEqual({ draft: blanks, pendingCode: null }); expect(store.values.size).toBe(0);
  });
  it('ignores corrupt cached identities and never promotes an unvalidated pending code into a request', () => {
    const store = new DeviceStore();
    for (const pending of [{ requestId: 'not-a-uuid', code: CIPHER_CODE_A }, { requestId: crypto.randomUUID(), code: ['cyan','red','red','red'] }]) {
      store.setItem('setup', JSON.stringify({ version: 1, draft: CIPHER_CODE_A, pending }));
      expect(new CipherSetupSession('setup', store).getSnapshot()).toEqual({ draft: blanks, pendingCode: null });
    }
  });
  it('retires a scoped setup and prevents an old completion from clearing the current setup', () => {
    const store = new DeviceStore(), old = new CipherSetupSession('old-scope', store); old.prepare(CIPHER_CODE_A); old.dispose();
    const current = new CipherSetupSession('new-scope', store); current.prepare(CIPHER_CODE_B);
    old.changeDraft(blanks); old.complete(); expect(() => old.prepare(CIPHER_CODE_A)).toThrow(/session changed/);
    expect(current.getSnapshot().pendingCode).toEqual(CIPHER_CODE_B);
    expect(new CipherSetupSession('old-scope', store).getSnapshot().pendingCode).toEqual(CIPHER_CODE_A);
  });
  it('retains same-session retry identity when storage is unavailable and clones caller-owned code arrays', () => {
    const store = { getItem: () => { throw new Error('Storage disabled'); }, setItem: () => { throw new Error('Storage disabled'); }, removeItem: () => { throw new Error('Storage disabled'); } };
    const session = new CipherSetupSession('setup', store), input = [...CIPHER_CODE_A] as typeof CIPHER_CODE_A;
    const prepared = session.prepare(input); input[0] = 'orange'; prepared.code[1] = 'orange';
    const retry = session.prepare(CIPHER_CODE_A);
    expect(retry.requestId).toBe(prepared.requestId); expect(retry.code).toEqual(CIPHER_CODE_A);
    session.complete(); expect(session.getSnapshot()).toEqual({ draft: blanks, pendingCode: null });
  });
});
