import { QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';

type DataError = {
  message?: string;
  code?: string;
};

type DataResult<T> = {
  data: T;
  error: DataError | null;
};

export class MemberDataError extends Error {
  readonly label: string;
  readonly code?: string;

  constructor(label: string, message: string, code?: string) {
    super(message);
    this.name = 'MemberDataError';
    this.label = label;
    this.code = code;
  }
}
/**
 * Runs a Supabase-style request with the member-page deadline and promotes
 * returned API errors to exceptions. Member pages can now use one predictable
 * try/catch/finally path for timeouts, network failures, and database errors.
 */
export async function memberData<T>(
  request: PromiseLike<DataResult<T>>,
  label: string,
  timeoutMs = QUERY_TIMEOUT_MS,
): Promise<T> {
  try {
    const result = await withTimeout(request, timeoutMs, label);
    if (result.error) {
      throw new MemberDataError(
        label,
        result.error.message || `${label} failed`,
        result.error.code,
      );
    }
    return result.data;
  } catch (error) {
    if (error instanceof MemberDataError) throw error;
    const message = error instanceof Error ? error.message : `${label} failed`;
    throw new MemberDataError(label, message);
  }
}

export function memberErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/timed out|network|fetch|offline/i.test(message)) {
    return 'The connection is taking longer than expected. Check your signal and try again.';
  }
  return 'We couldn’t load this right now. Please try again.';
}
