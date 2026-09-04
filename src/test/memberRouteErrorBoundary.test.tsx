import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemberRouteErrorBoundary } from '@/components/member/MemberRouteErrorBoundary';

function BrokenRoute() {
  throw new Error('render failed');
}

describe('MemberRouteErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an accessible recovery screen and resets after navigation', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const view = render(
      <MemberRouteErrorBoundary resetKey="/broken">
        <BrokenRoute />
      </MemberRouteErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('This page hit a snag');
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/dashboard');

    view.rerender(
      <MemberRouteErrorBoundary resetKey="/recovered">
        <p>Route recovered</p>
      </MemberRouteErrorBoundary>,
    );

    expect(await screen.findByText('Route recovered')).toBeInTheDocument();
  });
});
