// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const magicLinkSpy = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth-client', () => ({
  signIn: { magicLink: magicLinkSpy },
}));

import SignInClient from '../SignInClient';

describe('SignInClient', () => {
  beforeEach(() => {
    magicLinkSpy.mockReset();
  });
  afterEach(() => cleanup());

  it('renders magic-link form plus a disabled linkedin coming-soon button', () => {
    render(<SignInClient />);

    expect(screen.getByPlaceholderText('you@domain.com')).toBeTruthy();
    expect(screen.getByRole('button', { name: /send sign-in link/i })).toBeTruthy();

    const linkedin = screen.getByTestId('linkedin-signin-coming-soon');
    expect(linkedin).toHaveProperty('disabled', true);
    expect(linkedin.getAttribute('aria-disabled')).toBe('true');
    expect(linkedin.textContent?.toLowerCase()).toContain('log in with linkedin');
    expect(screen.getByText(/coming soon/i)).toBeTruthy();
  });

  it('does not start a linkedin oauth flow when the coming-soon button is clicked', () => {
    render(<SignInClient />);
    fireEvent.click(screen.getByTestId('linkedin-signin-coming-soon'));
    expect(magicLinkSpy).not.toHaveBeenCalled();
  });
});
