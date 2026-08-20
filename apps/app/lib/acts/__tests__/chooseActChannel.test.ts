import { describe, it, expect } from 'vitest';
import { chooseActChannel, hasUsableIdentityValue, intentForChannel } from '../chooseActChannel';

describe('chooseActChannel', () => {
  it('uses email when an address is on file', () => {
    expect(chooseActChannel({ kind: 'email', hasEmail: true, hasLinkedin: true })).toBe('email');
  });

  it('falls back to a linkedin note when there is a profile but no email', () => {
    expect(chooseActChannel({ kind: 'email', hasEmail: false, hasLinkedin: true })).toBe(
      'linkedin',
    );
    expect(chooseActChannel({ kind: 'todo', hasEmail: false, hasLinkedin: true })).toBe('linkedin');
  });

  it('keeps a private memo when there is no outbound channel', () => {
    expect(chooseActChannel({ kind: 'email', hasEmail: false, hasLinkedin: false })).toBe('memo');
  });

  it('keeps reminder, meeting, and intro kinds', () => {
    expect(chooseActChannel({ kind: 'reminder', hasEmail: true, hasLinkedin: true })).toBe(
      'reminder',
    );
    expect(chooseActChannel({ kind: 'meeting', hasEmail: false, hasLinkedin: false })).toBe(
      'meeting',
    );
    expect(chooseActChannel({ kind: 'intro', hasEmail: false, hasLinkedin: true })).toBe('intro');
  });

  it('maps channel to a polish intent', () => {
    expect(intentForChannel('email')).toBe('follow-up');
    expect(intentForChannel('linkedin')).toBe('linkedin-note');
    expect(intentForChannel('memo')).toBe('memo');
    expect(intentForChannel('reminder')).toBe('reminder');
    expect(intentForChannel('meeting')).toBe('reminder');
    expect(intentForChannel('intro')).toBe('intro');
  });

  it('treats blank identity values as missing', () => {
    expect(hasUsableIdentityValue('  ')).toBe(false);
    expect(hasUsableIdentityValue('ada@example.com')).toBe(true);
  });
});
