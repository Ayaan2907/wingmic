// the env-doc sync gate, ported from the old check (scripts/check.mjs section 4).
// contract: this package reads no environment variables - configuration arrives
// through arguments. if a future change reads process.env, this test fails until the
// read is documented in README.md ("## environment").
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const SOURCES = ["types.ts", "scoring.ts", "personas.ts", "contract.ts", "ingest.ts", "client.ts", "service.ts", "ratelimit.ts", "index.ts"];

describe("env-doc sync", () => {
  it("reads no environment variables anywhere in the package", () => {
    const offenders: string[] = [];
    for (const f of SOURCES) {
      const src = readFileSync(join(here, f), "utf8");
      if (/process\.env\b/.test(src)) offenders.push(f);
    }
    expect(offenders, `these files read process.env: ${offenders.join(", ")}`).toEqual([]);
  });

  it("documents the no-env contract in the README when the package ships env docs", () => {
    const readme = join(here, "..", "README.md");
    if (!existsSync(readme)) return; // README presence is not a src pin
    const text = readFileSync(readme, "utf8");
    expect(text).toMatch(/## environment/i);
    expect(text).toMatch(/reads no environment variables/i);
  });
});
