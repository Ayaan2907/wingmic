// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { PersonListRail } from '../PersonListRail';

afterEach(cleanup);

describe('PersonListRail', () => {
  it('renders nothing until wired to the live people list', () => {
    const { container } = render(<PersonListRail />);
    expect(container.childElementCount).toBe(0);
    expect(screen.queryByText(/sarah chen/i)).toBeNull();
    expect(screen.queryByLabelText(/^people$/i)).toBeNull();
  });
});
