/**
 * Eval runner — runs the canonical fixture set through the extractor
 * and reports per-fixture pass/fail + overall accuracy.
 *
 * Usage:
 *   bun run apps/web/lib/extractor/eval/runner.ts
 *   or via package.json:  bun run extract:eval
 *
 * Threshold: 85% pass rate or the run exits non-zero (CI gate).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extract } from '../client';
import { slugify } from '../slug';

interface FixtureExpect {
  persons?: Array<{
    name: string;
    role_contains?: string | null;
    companyHint?: string | null;
    topics_include?: string[];
    aliases_include?: string[];
  }>;
  companies_include?: string[];
  events_include?: string[];
  topics_include?: string[];
  actions?: Array<{ kind: string; body_contains?: string; whenHint_contains?: string }>;
}

interface Fixture {
  id: string;
  transcript: string;
  expected: FixtureExpect;
}

const THRESHOLD = 0.85;

async function run() {
  const path = resolve(__dirname, 'fixtures.json');
  const fixtures = JSON.parse(readFileSync(path, 'utf-8')) as Fixture[];

  let pass = 0;
  let fail = 0;
  const failures: string[] = [];

  for (const f of fixtures) {
    const t0 = Date.now();
    const result = await extract(f.transcript);
    const dt = Date.now() - t0;
    const issues = check(f, result);
    if (issues.length === 0) {
      pass++;
      console.log(`  ✓  ${f.id}  (${dt}ms)`);
    } else {
      fail++;
      failures.push(`✗  ${f.id}\n     ${issues.join('\n     ')}`);
      console.log(`  ✗  ${f.id}  (${dt}ms)`);
    }
  }

  const total = pass + fail;
  const rate = total === 0 ? 0 : pass / total;
  console.log('');
  console.log(`results: ${pass}/${total} passed  (${(rate * 100).toFixed(1)}%)`);
  if (failures.length) {
    console.log('');
    console.log('failures:');
    for (const f of failures) console.log('  ' + f);
  }
  if (rate < THRESHOLD) {
    console.error(`\nbelow ${(THRESHOLD * 100).toFixed(0)}% threshold — failing build`);
    process.exit(1);
  }
}

function check(f: Fixture, got: Awaited<ReturnType<typeof extract>>): string[] {
  const issues: string[] = [];
  const e = f.expected;

  // Persons
  if (e.persons) {
    for (const p of e.persons) {
      const found = got.persons.find(
        (g) => slugify(g.name).includes(slugify(p.name)) || slugify(p.name).includes(slugify(g.name)),
      );
      if (!found) {
        issues.push(`missing person: ${p.name}`);
        continue;
      }
      if (p.companyHint != null) {
        const expectedCo = slugify(p.companyHint);
        if (!found.companyHint || !slugify(found.companyHint).includes(expectedCo)) {
          issues.push(`person ${p.name} companyHint expected ~${p.companyHint}, got ${found.companyHint ?? 'null'}`);
        }
      }
      if (p.topics_include) {
        const gotTopics = found.topics.map(slugify);
        for (const t of p.topics_include) {
          const ts = slugify(t);
          if (!gotTopics.some((g) => g.includes(ts))) {
            issues.push(`person ${p.name} missing topic ${t}`);
          }
        }
      }
    }
  }

  // Companies
  if (e.companies_include) {
    const gotSlugs = got.companies.map((c) => slugify(c.name));
    for (const c of e.companies_include) {
      const cs = slugify(c);
      if (!gotSlugs.some((g) => g.includes(cs))) issues.push(`missing company: ${c}`);
    }
  }

  // Events (lenient — match ANY of the expected variants)
  if (e.events_include && e.events_include.length) {
    const gotSlugs = got.events.map((g) => slugify(g.name));
    const matched = e.events_include.some((v) => {
      const vs = slugify(v);
      return gotSlugs.some((g) => g.includes(vs) || vs.includes(g));
    });
    if (!matched) issues.push(`missing event from: ${e.events_include.join(', ')}`);
  }

  // Topics
  if (e.topics_include) {
    const gotSlugs = got.topics.map(slugify);
    for (const t of e.topics_include) {
      const ts = slugify(t);
      if (!gotSlugs.some((g) => g.includes(ts))) issues.push(`missing topic: ${t}`);
    }
  }

  // Actions
  if (e.actions) {
    for (const a of e.actions) {
      const found = got.actions.find((g) => g.kind === a.kind);
      if (!found) {
        issues.push(`missing action of kind: ${a.kind}`);
        continue;
      }
      if (a.body_contains && !found.body.toLowerCase().includes(a.body_contains.toLowerCase())) {
        issues.push(`action ${a.kind} body missing "${a.body_contains}"`);
      }
      if (a.whenHint_contains) {
        const w = found.whenHint?.toLowerCase() ?? '';
        if (!w.includes(a.whenHint_contains.toLowerCase())) {
          issues.push(`action ${a.kind} whenHint missing "${a.whenHint_contains}"`);
        }
      }
    }
  }

  return issues;
}

run().catch((err) => {
  console.error('eval runner crashed:', err);
  process.exit(1);
});
