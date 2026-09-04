import { describe, expect, it } from 'vitest';
import { MemberDataError, memberData, memberErrorMessage } from '@/lib/memberData';

describe('memberData', () => {
  it('returns successful data', async () => {
    await expect(memberData(Promise.resolve({ data: ['event'], error: null }), 'events')).resolves.toEqual(['event']);
  });

  it('promotes API errors with their label and code', async () => {
    const promise = memberData(
      Promise.resolve({ data: null, error: { message: 'permission denied', code: '42501' } }),
      'events',
    );
    await expect(promise).rejects.toMatchObject({
      name: 'MemberDataError',
      label: 'events',
      code: '42501',
    });
  });

  it('times out a request that never settles', async () => {
    const never = new Promise<{ data: null; error: null }>(() => undefined);
    await expect(memberData(never, 'slow query', 5)).rejects.toBeInstanceOf(MemberDataError);
  });

  it('uses a helpful message for network failures', () => {
    expect(memberErrorMessage(new Error('request timed out'))).toContain('connection');
    expect(memberErrorMessage(new Error('permission denied'))).toContain('couldn’t load');
  });
});
