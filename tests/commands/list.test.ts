import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeLockfile, type Lockfile, type SkillEntry } from "../../src/core/manifest.js";
import { hashDirectory } from "../../src/core/hash.js";
import { list } from "../../src/commands/list.js";

function makeEntry(overrides: Partial<SkillEntry> = {}): SkillEntry {
  return {
    name: "my-skill",
    repo: "helincao/skilled",
    remotePath: "skills/my-skill",
    commitSha: "abc123",
    syncedAt: "2025-01-01T00:00:00.000Z",
    installedHash: "0000000000000000",
    ...overrides,
  };
}

describe("list command", () => {
  let tmp: string;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "skilled-list-"));
    mkdirSync(join(tmp, "skills"), { recursive: true });
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    consoleSpy.mockRestore();
  });

  it("outputs empty array when no skills are tracked", async () => {
    writeLockfile(tmp, { version: 1, skills: {} });
    await list(tmp, { json: true });
    expect(consoleSpy).toHaveBeenCalledWith("[]");
  });

  it("reports clean status when hash matches", async () => {
    // Create skill directory with known content
    const skillDir = join(tmp, "skills", "my-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: my-skill\n---\n");

    const hash = hashDirectory(skillDir);
    const entry = makeEntry({ installedHash: hash });
    writeLockfile(tmp, { version: 1, skills: { "my-skill": entry } });

    await list(tmp, { json: true });
    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(output).toHaveLength(1);
    expect(output[0].name).toBe("my-skill");
    expect(output[0].status).toBe("clean");
  });

  it("reports modified status when hash differs", async () => {
    const skillDir = join(tmp, "skills", "my-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "changed content");

    // Use a hash that won't match
    const entry = makeEntry({ installedHash: "aaaaaaaaaaaaaaaa" });
    writeLockfile(tmp, { version: 1, skills: { "my-skill": entry } });

    await list(tmp, { json: true });
    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(output[0].status).toBe("modified");
  });

  it("reports missing status when skill directory does not exist", async () => {
    const entry = makeEntry();
    writeLockfile(tmp, { version: 1, skills: { "my-skill": entry } });

    await list(tmp, { json: true });
    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(output[0].status).toBe("missing");
  });

  it("lists multiple skills with mixed statuses", async () => {
    // One clean skill
    const cleanDir = join(tmp, "skills", "clean-skill");
    mkdirSync(cleanDir, { recursive: true });
    writeFileSync(join(cleanDir, "SKILL.md"), "clean");
    const cleanHash = hashDirectory(cleanDir);

    // One modified skill
    const modDir = join(tmp, "skills", "mod-skill");
    mkdirSync(modDir, { recursive: true });
    writeFileSync(join(modDir, "SKILL.md"), "modified");

    const lockfile: Lockfile = {
      version: 1,
      skills: {
        "clean-skill": makeEntry({ name: "clean-skill", installedHash: cleanHash }),
        "mod-skill": makeEntry({ name: "mod-skill", installedHash: "bbbbbbbbbbbbbbbb" }),
        "gone-skill": makeEntry({ name: "gone-skill" }),
      },
    };
    writeLockfile(tmp, lockfile);

    await list(tmp, { json: true });
    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(output).toHaveLength(3);

    const byName = Object.fromEntries(output.map((e: any) => [e.name, e.status]));
    expect(byName["clean-skill"]).toBe("clean");
    expect(byName["mod-skill"]).toBe("modified");
    expect(byName["gone-skill"]).toBe("missing");
  });
});
