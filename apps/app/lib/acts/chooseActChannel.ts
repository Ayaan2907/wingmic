export type ActKind = 'reminder' | 'email' | 'meeting' | 'todo' | 'intro';

export type ActChannel = 'email' | 'linkedin' | 'reminder' | 'meeting' | 'intro' | 'memo';

export function hasUsableIdentityValue(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function chooseActChannel(opts: {
  kind: ActKind;
  hasEmail: boolean;
  hasLinkedin: boolean;
}): ActChannel {
  switch (opts.kind) {
    case 'intro':
      return 'intro';
    case 'meeting':
      return 'meeting';
    case 'reminder':
      return 'reminder';
    case 'email':
    case 'todo':
      if (opts.hasEmail) return 'email';
      if (opts.hasLinkedin) return 'linkedin';
      return 'memo';
    default: {
      const _exhaustive: never = opts.kind;
      return _exhaustive;
    }
  }
}

export function intentForChannel(
  channel: ActChannel,
): 'intro' | 'reminder' | 'linkedin-note' | 'memo' | 'follow-up' {
  switch (channel) {
    case 'intro':
      return 'intro';
    case 'reminder':
    case 'meeting':
      return 'reminder';
    case 'linkedin':
      return 'linkedin-note';
    case 'memo':
      return 'memo';
    case 'email':
      return 'follow-up';
    default: {
      const _exhaustive: never = channel;
      return _exhaustive;
    }
  }
}
