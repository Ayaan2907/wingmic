/**
 * Contact Picker API → ImportContactDraft[] (I4).
 * Returns null when the API is unavailable so callers fall back to vCard.
 */

import type { ImportContactDraft } from './types';

type ContactInfo = {
  name?: string[];
  email?: string[];
  tel?: string[];
};

type ContactsManager = {
  select: (
    properties: string[],
    options?: { multiple?: boolean },
  ) => Promise<ContactInfo[]>;
};

function contactsApi(): ContactsManager | null {
  if (typeof navigator === 'undefined') return null;
  const n = navigator as Navigator & { contacts?: ContactsManager };
  return n.contacts ?? null;
}

export function deviceContactsSupported(): boolean {
  return contactsApi() != null;
}

export async function pickDeviceContacts(): Promise<ImportContactDraft[] | null> {
  const api = contactsApi();
  if (!api) return null;
  const rows = await api.select(['name', 'email', 'tel'], { multiple: true });
  const out: ImportContactDraft[] = [];
  for (const row of rows) {
    const name = (row.name?.[0] ?? '').trim();
    if (!name) continue;
    const email = (row.email?.[0] ?? '').trim() || null;
    const phone = (row.tel?.[0] ?? '').trim() || null;
    out.push({
      name,
      email: email && email.includes('@') ? email : null,
      linkedinUrl: null,
      company: null,
      role: null,
      phone,
      notes: null,
    });
  }
  return out;
}
