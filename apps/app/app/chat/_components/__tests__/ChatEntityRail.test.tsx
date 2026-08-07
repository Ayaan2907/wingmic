// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { ChatEntityRail } from '../ChatEntityRail';

afterEach(cleanup);

describe('ChatEntityRail', () => {
  it('renders nothing until wired to live thread entities', () => {
    const { container } = render(<ChatEntityRail />);
    expect(container.childElementCount).toBe(0);
    expect(screen.queryByText(/sarah chen/i)).toBeNull();
    expect(screen.queryByLabelText(/entities in this thread/i)).toBeNull();
  });
});
