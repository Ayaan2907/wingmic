/**
 * One-off bulk sender for wingmic announcement / outreach emails.
 *
 * Reads an HTML template from disk, substitutes `{{placeholders}}` per
 * recipient, and sends one separate email each through Resend's batch
 * endpoint (recipients never see each other).
 *
 * Dry run is the default — nothing leaves the machine without `--send`.
 *
 *   # plain list, one address per line:
 *   bun run email:send --template emails/beta-launch.html \
 *     --subject "your wingmic seat is ready" --to-file emails/wave-1.txt
 *
 *   # CSV with merge vars (header row starting with `email`):
 *   bun run email:send:doppler --template emails/beta-launch.html \
 *     --subject "your wingmic seat is ready" --to-file emails/wave-1.csv \
 *     --unsubscribe-url https://wingmic.xyz/unsubscribe --send
 *
 * Placeholders: `{{name}}` or `{{name|fallback}}`. `{{email}}` is always
 * available. Values are HTML-escaped. A placeholder with no value and no
 * fallback is an error at dry-run time, not a blank in someone's inbox.
 *
 * Env: RESEND_API_KEY (required for --send), RESEND_FROM (optional override).
 */
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';

const BATCH_SIZE = 100; // Resend batch endpoint hard limit
const BATCH_DELAY_MS = 600; // stay under Resend's 2 req/s default rate limit
const DEFAULT_FROM = 'wingmic <info@mail.wingmic.xyz>';

const { values } = parseArgs({
  options: {
    template: { type: 'string' },
    subject: { type: 'string' },
    to: { type: 'string' },
    'to-file': { type: 'string' },
    from: { type: 'string' },
    'reply-to': { type: 'string' },
    'unsubscribe-url': { type: 'string' },
    send: { type: 'boolean', default: false },
  },
});

function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

if (!values.template) fail('--template <path-to-html> is required');
if (!values.subject) fail('--subject "<line>" is required');
if (!values.to && !values['to-file']) fail('--to or --to-file is required');

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Recipient = { email: string; vars: Record<string, string> };

/** Split one CSV line, honouring "quoted, fields" and "" escapes. */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Plain mode: one address per line (or comma-separated), `#` comments ignored.
 * CSV mode: auto-detected when the first data line starts with an `email`
 * column. Remaining columns become merge vars.
 */
function parseRecipients(raw: string): Recipient[] {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length === 0) return [];

  const header = splitCsv(lines[0]);
  const isCsv = header.length > 1 && header[0].toLowerCase() === 'email';

  const seen = new Set<string>();
  const out: Recipient[] = [];

  const push = (email: string, vars: Record<string, string>) => {
    const addr = email.trim().toLowerCase();
    if (!addr) return;
    if (!EMAIL_RE.test(addr)) fail(`not an email address: ${email}`);
    if (seen.has(addr)) return;
    seen.add(addr);
    out.push({ email: addr, vars: { ...vars, email: addr } });
  };

  if (isCsv) {
    const cols = header.map((h) => h.toLowerCase());
    for (const line of lines.slice(1)) {
      const cells = splitCsv(line);
      const vars: Record<string, string> = {};
      cols.forEach((c, i) => { vars[c] = cells[i] ?? ''; });
      push(cells[0] ?? '', vars);
    }
  } else {
    for (const line of lines) {
      for (const addr of line.split(',')) push(addr, {});
    }
  }
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PLACEHOLDER = /\{\{(\w+)(?:\|([^}]*))?\}\}/g;

/** Substitute `{{var}}` / `{{var|fallback}}`. Unresolved names are collected. */
function render(tpl: string, vars: Record<string, string>, unresolved: Set<string>): string {
  return tpl.replace(PLACEHOLDER, (_m, key: string, fallback?: string) => {
    const v = vars[key.toLowerCase()]?.trim();
    if (v) return escapeHtml(v);
    if (fallback !== undefined) return escapeHtml(fallback);
    unresolved.add(key);
    return '';
  });
}

const html = readFileSync(values.template, 'utf8');
const recipients = parseRecipients(
  [values.to, values['to-file'] ? readFileSync(values['to-file'], 'utf8') : '']
    .filter(Boolean)
    .join('\n'),
);
if (recipients.length === 0) fail('no recipients found');

const from = values.from ?? process.env.RESEND_FROM ?? DEFAULT_FROM;
const headers: Record<string, string> = {};
if (values['unsubscribe-url']) {
  headers['List-Unsubscribe'] = `<${values['unsubscribe-url']}>`;
  headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
}

// Render everything up front so a bad template fails before any send.
const unresolved = new Set<string>();
const payloads = recipients.map((r) => ({
  from,
  to: [r.email],
  subject: render(values.subject!, r.vars, unresolved),
  html: render(html, r.vars, unresolved),
  ...(values['reply-to'] ? { reply_to: values['reply-to'] } : {}),
  ...(Object.keys(headers).length ? { headers } : {}),
}));

const placeholders = [...html.matchAll(PLACEHOLDER)].map((m) => m[1]);
const batches: (typeof payloads)[] = [];
for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
  batches.push(payloads.slice(i, i + BATCH_SIZE));
}

console.log(`template : ${values.template} (${html.length} bytes)`);
console.log(`from     : ${from}`);
if (values['reply-to']) console.log(`reply-to : ${values['reply-to']}`);
console.log(`subject  : ${payloads[0].subject}`);
console.log(`vars     : ${[...new Set(placeholders)].join(', ') || '(none)'}`);
console.log(`unsub    : ${values['unsubscribe-url'] ?? 'NOT SET'}`);
console.log(`to       : ${recipients.length} address(es) in ${batches.length} batch(es)`);
console.log(recipients.map((r) => `  - ${r.email}`).join('\n'));

if (unresolved.size > 0) {
  fail(
    `template placeholder(s) with no value and no fallback: ${[...unresolved].join(', ')}\n` +
      `  add the column to --to-file, or give the placeholder a fallback: {{${[...unresolved][0]}|there}}`,
  );
}

if (!values['unsubscribe-url']) {
  console.warn(
    '\nwarning: no --unsubscribe-url. Bulk mail needs a working unsubscribe —\n' +
      '  both the List-Unsubscribe header and a link in the template.',
  );
}

if (!values.send) {
  console.log('\ndry run — nothing sent. re-run with --send to deliver.');
  process.exit(0);
}

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) fail('RESEND_API_KEY is not set (try: bun run email:send:doppler ...)');

let sent = 0;
for (const [i, batch] of batches.entries()) {
  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(batch),
  });

  if (!res.ok) {
    console.error(`batch ${i + 1}/${batches.length} failed (${res.status}): ${await res.text()}`);
    console.error(`stopped after ${sent} sent. remaining addresses were not contacted.`);
    process.exit(1);
  }
  sent += batch.length;
  console.log(`batch ${i + 1}/${batches.length} sent (${sent}/${recipients.length})`);

  if (i < batches.length - 1) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
}

console.log(`\ndone — ${sent} email(s) sent from ${from}.`);
