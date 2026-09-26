// the unslop gate, ported from the old check (scripts/check.mjs section 5): banned
// words never appear in visitor-facing copy this package exports. the original scanned
// the html pages; the merge surfaces copy from typed modules, so the scan reads the
// string literals of the copy-carrying sources instead. word-boundary matching, like
// the original regex — "leveraged" is not the slop; "leverage" is.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

// the exported visitor-facing strings (scoring copy + the honest empty-state line).
const COPY_FILES = ["scoring.ts", "service.ts", "client.ts", "ingest.ts"];

// the original nine stems, plus the extra phrases the old page scan effectively
// covered; matching stays word-bounded.
const BANNED = [
  "delve",
  "robust",
  "seamless",
  "cutting-edge",
  "leverage",
  "comprehensive",
  "game-changer",
  "revolutionary",
  "supercharge",
  "unleash",
  "elevate your",
  "take it to the next level",
  "in today's fast-paced",
  "in the realm of",
];

function violationsIn(src: string, file: string): string[] {
  const out: string[] = [];
  // crude but bounded: every "..."/'...' literal on a non-comment line
  for (const line of src.split("\n")) {
    if (line.trim().startsWith("//")) continue;
    const literals = line.match(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g) || [];
    for (const literal of literals) {
      const text = literal.slice(1, -1).toLowerCase();
      for (const word of BANNED) {
        const re = new RegExp(`\\b${word}\\b`, "i");
        if (re.test(text)) out.push(`${file}: banned word "${word}" in "${literal.slice(0, 80)}"`);
      }
    }
  }
  return out;
}

describe("unslop copy gate", () => {
  it("keeps banned slop words out of visitor-facing copy", () => {
    const violations: string[] = [];
    for (const f of COPY_FILES) {
      const src = readFileSync(join(here, f), "utf8");
      violations.push(...violationsIn(src, f));
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("keeps the honest empty-state copy honest", () => {
    const src = readFileSync(join(here, "scoring.ts"), "utf8");
    expect(src).toContain("no read on this room yet");
  });
});
