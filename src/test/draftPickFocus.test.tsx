import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MakePickSheet } from '@/components/draft/MakePickSheet';

vi.mock('@/components/draft/PersonalDraftDesk', () => ({ PersonalDraftDesk: () => <section>Saved ideas</section> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('focuses the portaled pick once with preventScroll and retains typed text across advisory updates', async () => {
  const focus = vi.spyOn(HTMLInputElement.prototype, 'focus');
  const submit = vi.fn();
  function Harness({ suggest = false }: { suggest?: boolean }) {
    const [text, setText] = useState('');
    return <MakePickSheet open onClose={() => {}} currentRound={2} currentPickNumber={4}
      topic="Movie night" pickText={text} onTextChange={setText} onSubmit={submit}
      submitting={false} localDuplicate={false} suggestion={suggest ? { corrected_text: 'Interstellar' } : null}
      onApplyCorrection={setText} onDismissSuggestion={() => {}} />;
  }
  const view = render(<Harness />);
  const input = await screen.findByRole('textbox', { name: 'Your draft pick' });
  await waitFor(() => expect(input).toHaveFocus());
  expect(focus).toHaveBeenCalledTimes(1);
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  fireEvent.change(input, { target: { value: 'Interstella' } });
  (input as HTMLInputElement).setSelectionRange(4, 4);
  view.rerender(<Harness suggest />);
  expect(input).toHaveValue('Interstella');
  expect((input as HTMLInputElement).selectionStart).toBe(4);
  expect(input).toHaveFocus();
  expect(focus).toHaveBeenCalledTimes(1);
  expect(submit).not.toHaveBeenCalled();
});
