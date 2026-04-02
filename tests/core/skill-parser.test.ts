import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseSkillMeta } from "../../src/core/skill-parser.js";

describe("parseSkillMeta", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "skilled-parser-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("parses valid SKILL.md with name and description", () => {
    writeFileSync(
      join(tmp, "SKILL.md"),
      `---
name: Build Tool
description: Compiles the project
---

# Build Tool

Usage instructions here.
`,
    );
    const meta = parseSkillMeta(tmp);
    expect(meta).toEqual({ name: "Build Tool", description: "Compiles the project" });
  });

  it("parses SKILL.md with name only (no description)", () => {
    writeFileSync(
      join(tmp, "SKILL.md"),
      `---
name: Linter
---

Content.
`,
    );
    const meta = parseSkillMeta(tmp);
    expect(meta).toEqual({ name: "Linter", description: "" });
  });

  it("returns null when SKILL.md is missing", () => {
    expect(parseSkillMeta(tmp)).toBeNull();
  });

  it("returns null when frontmatter has no name", () => {
    writeFileSync(
      join(tmp, "SKILL.md"),
      `---
description: No name field
---

Content.
`,
    );
    expect(parseSkillMeta(tmp)).toBeNull();
  });

  it("returns null when name is not a string", () => {
    writeFileSync(
      join(tmp, "SKILL.md"),
      `---
name: 123
---

Content.
`,
    );
    expect(parseSkillMeta(tmp)).toBeNull();
  });

  it("returns null for file with no frontmatter", () => {
    writeFileSync(join(tmp, "SKILL.md"), "# Just markdown\n\nNo frontmatter.");
    const meta = parseSkillMeta(tmp);
    expect(meta).toBeNull();
  });
});
