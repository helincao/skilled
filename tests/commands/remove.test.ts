import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeLockfile, readLockfile, type Lockfile, type SkillEntry } from "../../src/core/manifest.js";

vi.mock("../../src/core/agents.js", () => ({
  detectAgents: vi.fn().mockReturnValue([]),
  resolveAgentTypes: vi.fn().mockReturnValue([]),
}));

vi.mock("../../src/core/distribute.js", () => ({
  removeSkillLinks: vi.fn(),
  getCustomDirs: vi.fn().mockReturnValue([]),
}));

import { remove } from "../../src/commands/remove.js";

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

describe("remove command", () => {
  let tmp: string;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "skilled-remove-"));
    mkdirSync(join(tmp, ".agents", "skills"), { recursive: true });
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    consoleSpy.mockRestore();
  });

  it("throws when skill is not tracked", async () => {
    writeLockfile(tmp, { version: 1, skills: {} });
    await expect(remove(tmp, "unknown-skill", { json: true })).rejects.toThrow(
      'Skill "unknown-skill" is not tracked',
    );
  });

  it("removes skill directory and lockfile entry", async () => {
    const skillDir = join(tmp, ".agents", "skills", "my-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "content");

    const lockfile: Lockfile = {
      version: 1,
      skills: { "my-skill": makeEntry() },
    };
    writeLockfile(tmp, lockfile);

    await remove(tmp, "my-skill", { json: true });

    // Directory should be gone
    expect(existsSync(skillDir)).toBe(false);

    // Lockfile entry should be gone
    const updated = readLockfile(tmp);
    expect(updated.skills["my-skill"]).toBeUndefined();
  });

  it("removes lockfile entry even when directory is already missing", async () => {
    const lockfile: Lockfile = {
      version: 1,
      skills: { "my-skill": makeEntry() },
    };
    writeLockfile(tmp, lockfile);

    await remove(tmp, "my-skill", { json: true });

    const updated = readLockfile(tmp);
    expect(updated.skills["my-skill"]).toBeUndefined();
  });

  it("outputs JSON confirmation when json option is set", async () => {
    const lockfile: Lockfile = {
      version: 1,
      skills: { "my-skill": makeEntry() },
    };
    writeLockfile(tmp, lockfile);

    await remove(tmp, "my-skill", { json: true });
    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(output).toEqual({ removed: "my-skill" });
  });

  it("does not affect other skills in lockfile", async () => {
    const lockfile: Lockfile = {
      version: 1,
      skills: {
        "my-skill": makeEntry(),
        "other-skill": makeEntry({ name: "other-skill", remotePath: "skills/other-skill" }),
      },
    };
    writeLockfile(tmp, lockfile);

    await remove(tmp, "my-skill", { json: true });

    const updated = readLockfile(tmp);
    expect(updated.skills["my-skill"]).toBeUndefined();
    expect(updated.skills["other-skill"]).toBeDefined();
  });
});
