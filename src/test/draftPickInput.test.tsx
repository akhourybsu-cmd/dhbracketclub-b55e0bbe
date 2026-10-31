import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PickComposerFields } from '@/components/draft/MakePickSheet';

afterEach(cleanup);

it.each([
  { label: 'native composition', event: { isComposing: true, keyCode: 13 } },
  { label: 'legacy IME key', event: { isComposing: false, keyCode: 229 } },
])('keeps $label Enter from submitting an unfinished pick', ({ event }) => {
  const submit = vi.fn();
  const props = {
    pickText: '進撃の', onTextChange: vi.fn(), onSubmit: submit,
    submitting: false, localDuplicate: false, suggestion: null,
    onApplyCorrection: vi.fn(), onDismissSuggestion: vi.fn(), topic: 'Best anime',
  };
  const view = render(<PickComposerFields {...props} />);
  const input = screen.getByRole('textbox', { name: 'Your draft pick' });
  fireEvent.compositionStart(input);
  fireEvent.keyDown(input, { key: 'Enter', ...event });
  expect(submit).not.toHaveBeenCalled();

  view.rerender(<PickComposerFields {...props} pickText="進撃の巨人" />);
  fireEvent.compositionEnd(input, { data: '進撃の巨人' });
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 13, isComposing: false });
  expect(input).toHaveValue('進撃の巨人');
  expect(submit).toHaveBeenCalledTimes(1);
});
