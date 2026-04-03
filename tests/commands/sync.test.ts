import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  writeLockfile,
  readLockfile,
  type Lockfile,
  type SkillEntry,
} from "../../src/core/manifest.js";
import { hashDirectory } from "../../src/core/hash.js";

// ── Mocks ────────────────────────────────────────────────
vi.mock("../../src/core/git.js", () => ({
  shallowClone: vi.fn(),
}));

vi.mock("../../src/core/github.js", () => ({
  fetchTreeSha: vi.fn().mockResolvedValue("fake-tree-sha"),
}));

vi.mock("../../src/core/agents.js", () => ({
  detectAgents: vi.fn().mockReturnValue([]),
  resolveAgentTypes: vi.fn().mockReturnValue([]),
}));

vi.mock("../../src/core/distribute.js", () => ({
  distributeSkill: vi.fn(),
  getCustomDirs: vi.fn().mockReturnValue([]),
}));

import { shallowClone } from "../../src/core/git.js";
import { sync } from "../../src/commands/sync.js";

const FAKE_SHA = "abc1234567890def";

function makeEntry(overrides: Partial<SkillEntry> = {}): SkillEntry {
  return {
    name: "my-skill",
    repo: "owner/repo",
    remotePath: "skills/my-skill",
    commitSha: FAKE_SHA,
    syncedAt: "2025-01-01T00:00:00.000Z",
    installedHash: "0000000000000000",
    ...overrides,
  };
}

function createFakeRemote(tmp: string, skills: string[]): string {
  const remoteDir = join(tmp, "_remote");
  const remoteSkillsDir = join(remoteDir, "skills");
  mkdirSync(remoteSkillsDir, { recursive: true });

  for (const name of skills) {
    const skillDir = join(remoteSkillsDir, name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, "SKILL.md"),
      `---\nname: ${name}\ndescription: A skill\n---\nUpdated content for ${name}`,
    );
  }

  return remoteDir;
}

function setupCloneMock(tmp: string, skills: string[]) {
  const remoteDir = createFakeRemote(tmp, skills);
  vi.mocked(shallowClone).mockResolvedValue({
    dir: remoteDir,
    headSha: "new-sha-1234567",
    cleanup: vi.fn(),
  });
  return remoteDir;
}

describe("sync command", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "skilled-sync-"));
    mkdirSync(join(tmp, ".agents", "skills"), { recursive: true });
    vi.mocked(shallowClone).mockReset();
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("does nothing when no skills are tracked", async () => {
    writeLockfile(tmp, { version: 1, skills: {} });
    await sync(tmp);
    expect(shallowClone).not.toHaveBeenCalled();
  });

  it("syncs a single skill from remote", async () => {
    const skillDir = join(tmp, ".agents", "skills", "my-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "old content");

    const hash = hashDirectory(skillDir);
    writeLockfile(tmp, {
      version: 1,
      skills: { "my-skill": makeEntry({ installedHash: hash }) },
    });

    setupCloneMock(tmp, ["my-skill"]);

    await sync(tmp);

    const content = readFileSync(join(skillDir, "SKILL.md"), "utf-8");
    expect(content).toContain("Updated content for my-skill");

    const lockfile = readLockfile(tmp);
    expect(lockfile.skills["my-skill"].commitSha).toBe("new-sha-1234567");
  });

  it("refuses to overwrite local modifications without --force", async () => {
    const skillDir = join(tmp, ".agents", "skills", "my-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "locally modified content");

    // Hash won't match since content differs
    writeLockfile(tmp, {
      version: 1,
      skills: { "my-skill": makeEntry({ installedHash: "original-hash" }) },
    });

    setupCloneMock(tmp, ["my-skill"]);

    await sync(tmp);

    // Content should NOT have been overwritten
    const content = readFileSync(join(skillDir, "SKILL.md"), "utf-8");
    expect(content).toBe("locally modified content");
  });

  it("overwrites local modifications with --force", async () => {
    const skillDir = join(tmp, ".agents", "skills", "my-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "locally modified");

    writeLockfile(tmp, {
      version: 1,
      skills: { "my-skill": makeEntry({ installedHash: "original-hash" }) },
    });

    setupCloneMock(tmp, ["my-skill"]);

    await sync(tmp, undefined, { force: true });

    const content = readFileSync(join(skillDir, "SKILL.md"), "utf-8");
    expect(content).toContain("Updated content for my-skill");
  });

  it("warns when remote skill no longer exists", async () => {
    const skillDir = join(tmp, ".agents", "skills", "deleted-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "content");

    const hash = hashDirectory(skillDir);
    writeLockfile(tmp, {
      version: 1,
      skills: {
        "deleted-skill": makeEntry({
          name: "deleted-skill",
          remotePath: "skills/deleted-skill",
          installedHash: hash,
        }),
      },
    });

    // Remote only has "other-skill", not "deleted-skill"
    setupCloneMock(tmp, ["other-skill"]);

    await sync(tmp);

    // Local content should be untouched
    const content = readFileSync(join(skillDir, "SKILL.md"), "utf-8");
    expect(content).toBe("content");
  });

  it("syncs only the named skill when specified", async () => {
    const skillADir = join(tmp, ".agents", "skills", "skill-a");
    const skillBDir = join(tmp, ".agents", "skills", "skill-b");
    mkdirSync(skillADir, { recursive: true });
    mkdirSync(skillBDir, { recursive: true });
    writeFileSync(join(skillADir, "SKILL.md"), "old a");
    writeFileSync(join(skillBDir, "SKILL.md"), "old b");

    const hashA = hashDirectory(skillADir);
    const hashB = hashDirectory(skillBDir);

    writeLockfile(tmp, {
      version: 1,
      skills: {
        "skill-a": makeEntry({
          name: "skill-a",
          remotePath: "skills/skill-a",
          installedHash: hashA,
        }),
        "skill-b": makeEntry({
          name: "skill-b",
          remotePath: "skills/skill-b",
          installedHash: hashB,
        }),
      },
    });

    setupCloneMock(tmp, ["skill-a", "skill-b"]);

    await sync(tmp, "skill-a");

    // skill-a should be updated
    expect(readFileSync(join(skillADir, "SKILL.md"), "utf-8")).toContain(
      "Updated content for skill-a",
    );
    // skill-b should be untouched
    expect(readFileSync(join(skillBDir, "SKILL.md"), "utf-8")).toBe("old b");
  });

  it("syncs a new skill that does not yet exist locally", async () => {
    writeLockfile(tmp, {
      version: 1,
      skills: { "my-skill": makeEntry() },
    });

    setupCloneMock(tmp, ["my-skill"]);

    await sync(tmp);

    const content = readFileSync(
      join(tmp, ".agents", "skills", "my-skill", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("Updated content for my-skill");
  });

  it("updates lockfile hash and treeSha after sync", async () => {
    const skillDir = join(tmp, ".agents", "skills", "my-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "old");

    const hash = hashDirectory(skillDir);
    writeLockfile(tmp, {
      version: 1,
      skills: {
        "my-skill": makeEntry({
          installedHash: hash,
          treeSha: "old-tree-sha",
        }),
      },
    });

    setupCloneMock(tmp, ["my-skill"]);

    await sync(tmp);

    const lockfile = readLockfile(tmp);
    const entry = lockfile.skills["my-skill"];
    expect(entry.commitSha).toBe("new-sha-1234567");
    expect(entry.treeSha).toBe("fake-tree-sha");
    expect(entry.installedHash).not.toBe(hash);
  });
});
