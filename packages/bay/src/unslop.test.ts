// the unslop gate, ported from the old check (scripts/check.mjs section 5): banned
// words never appear in visitor-facing copy this package exports.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

// the exported visitor-facing strings (scoring copy + the honest empty-state line).
const COPY_FILES = ["scoring.ts", "service.ts", "client.ts", "ingest.ts"];

const BANNED = [
  "delve", "delves", "delving",
  "robust", "seamless", "seamlessly",
  "unleash", "unleashing", "game-changer", "game changer", "game-changing",
  "cutting-edge", "harness the power", "elevate your", "take it to the next level",
  "supercharge", "in today's fast-paced", "in the realm of", "testament to",
];

function stringLiterals(src: string): string[] {
  const out: string[] = [];
  // crude but bounded: every "..." or '...' literal on a copy line
  for (const line of src.split("\n")) {
    if (line.trim().startsWith("//")) continue;
    const matches = line.match(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g) || [];
    out.push(...matches.map((m) => m.slice(1, -1)));
  }
  return out;
}

describe("unslop copy gate", () => {
  it("keeps banned slop words out of visitor-facing copy", () => {
    const violations: string[] = [];
    for (const f of COPY_FILES) {
      const src = readFileSync(join(here, f), "utf8");
      for (const s of stringLiterals(src)) {
        const low = s.toLowerCase();
        for (const word of BANNED) {
          if (low.includes(word)) violations.push(`${f}: "${word}" in "${s.slice(0, 80)}"`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("keeps the honest empty-state copy honest", () => {
    const src = readFileSync(join(here, "scoring.ts"), "utf8");
    expect(src).toContain("no read on the room yet");
  });
});
