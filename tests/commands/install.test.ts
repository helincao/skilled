import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
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

// ── Mocks ────────────────────────────────────────────────
// Mock git clone to create a local fake repo structure instead of hitting the network
vi.mock("../../src/core/git.js", () => ({
  shallowClone: vi.fn(),
}));

// Mock GitHub tree SHA fetch
vi.mock("../../src/core/github.js", () => ({
  fetchTreeSha: vi.fn().mockResolvedValue("fake-tree-sha"),
}));

// Mock agent detection — return empty to skip instruction file writes
vi.mock("../../src/core/agents.js", () => ({
  detectAgents: vi.fn().mockReturnValue([]),
  resolveAgentTypes: vi.fn().mockReturnValue([]),
}));

// Mock distribute — no symlinks in tests
vi.mock("../../src/core/distribute.js", () => ({
  distributeSkill: vi.fn(),
  getCustomDirs: vi.fn().mockReturnValue([]),
}));

import { shallowClone } from "../../src/core/git.js";
import { install, installFromLockfile } from "../../src/commands/install.js";

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

/**
 * Create a fake remote repo directory with skill subdirectories.
 * Returns the path to the fake clone root.
 */
function createFakeRemote(tmp: string, skills: string[]): string {
  const remoteDir = join(tmp, "_remote");
  const remoteSkillsDir = join(remoteDir, "skills");
  mkdirSync(remoteSkillsDir, { recursive: true });

  for (const name of skills) {
    const skillDir = join(remoteSkillsDir, name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, "SKILL.md"),
      `---\nname: ${name}\ndescription: A skill\n---\nContent for ${name}`,
    );
  }

  return remoteDir;
}

function setupCloneMock(tmp: string, skills: string[]) {
  const remoteDir = createFakeRemote(tmp, skills);
  vi.mocked(shallowClone).mockResolvedValue({
    dir: remoteDir,
    headSha: FAKE_SHA,
    cleanup: vi.fn(),
  });
  return remoteDir;
}

describe("installFromLockfile", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "skilled-install-"));
    mkdirSync(join(tmp, ".agents", "skills"), { recursive: true });
    vi.mocked(shallowClone).mockReset();
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("does nothing when lockfile has no skills", async () => {
    writeLockfile(tmp, { version: 1, skills: {} });
    await installFromLockfile(tmp, {});
    expect(shallowClone).not.toHaveBeenCalled();
  });

  it("restores a single skill from lockfile", async () => {
    writeLockfile(tmp, {
      version: 1,
      skills: { "my-skill": makeEntry() },
    });

    setupCloneMock(tmp, ["my-skill"]);

    await installFromLockfile(tmp, {});

    expect(existsSync(join(tmp, ".agents", "skills", "my-skill", "SKILL.md"))).toBe(true);
    expect(shallowClone).toHaveBeenCalledTimes(1);
  });

  it("restores multiple skills from the same repo with a single clone", async () => {
    writeLockfile(tmp, {
      version: 1,
      skills: {
        "skill-a": makeEntry({
          name: "skill-a",
          remotePath: "skills/skill-a",
        }),
        "skill-b": makeEntry({
          name: "skill-b",
          remotePath: "skills/skill-b",
        }),
      },
    });

    setupCloneMock(tmp, ["skill-a", "skill-b"]);

    await installFromLockfile(tmp, {});

    expect(existsSync(join(tmp, ".agents", "skills", "skill-a", "SKILL.md"))).toBe(true);
    expect(existsSync(join(tmp, ".agents", "skills", "skill-b", "SKILL.md"))).toBe(true);
    // Only one clone for one repo
    expect(shallowClone).toHaveBeenCalledTimes(1);
  });

  it("clones each repo only once when skills come from different repos", async () => {
    writeLockfile(tmp, {
      version: 1,
      skills: {
        "skill-a": makeEntry({
          name: "skill-a",
          repo: "owner/repo-one",
          remotePath: "skills/skill-a",
        }),
        "skill-b": makeEntry({
          name: "skill-b",
          repo: "owner/repo-two",
          remotePath: "skills/skill-b",
        }),
      },
    });

    // Both repos return different fake remotes but our mock returns the same structure
    const remoteDir = createFakeRemote(tmp, ["skill-a", "skill-b"]);
    vi.mocked(shallowClone).mockResolvedValue({
      dir: remoteDir,
      headSha: FAKE_SHA,
      cleanup: vi.fn(),
    });

    await installFromLockfile(tmp, {});

    // Two different repos → two clones
    expect(shallowClone).toHaveBeenCalledTimes(2);
  });

  it("skips existing skills without --force", async () => {
    // Pre-create the skill directory
    const existingDir = join(tmp, ".agents", "skills", "my-skill");
    mkdirSync(existingDir, { recursive: true });
    writeFileSync(join(existingDir, "SKILL.md"), "existing content");

    writeLockfile(tmp, {
      version: 1,
      skills: { "my-skill": makeEntry() },
    });

    setupCloneMock(tmp, ["my-skill"]);

    await installFromLockfile(tmp, {});

    // Should preserve the existing content
    expect(readFileSync(join(existingDir, "SKILL.md"), "utf-8")).toBe(
      "existing content",
    );
  });

  it("overwrites existing skills with --force", async () => {
    const existingDir = join(tmp, ".agents", "skills", "my-skill");
    mkdirSync(existingDir, { recursive: true });
    writeFileSync(join(existingDir, "SKILL.md"), "existing content");

    writeLockfile(tmp, {
      version: 1,
      skills: { "my-skill": makeEntry() },
    });

    setupCloneMock(tmp, ["my-skill"]);

    await installFromLockfile(tmp, { force: true });

    const content = readFileSync(join(existingDir, "SKILL.md"), "utf-8");
    expect(content).toContain("Content for my-skill");
  });

  it("updates lockfile entries after restoring", async () => {
    writeLockfile(tmp, {
      version: 1,
      skills: { "my-skill": makeEntry() },
    });

    setupCloneMock(tmp, ["my-skill"]);

    await installFromLockfile(tmp, {});

    const updated = readLockfile(tmp);
    expect(updated.skills["my-skill"]).toBeDefined();
    expect(updated.skills["my-skill"].commitSha).toBe(FAKE_SHA);
    expect(updated.skills["my-skill"].treeSha).toBe("fake-tree-sha");
  });

  it("warns and skips when a lockfile skill is missing from remote", async () => {
    writeLockfile(tmp, {
      version: 1,
      skills: {
        "deleted-skill": makeEntry({
          name: "deleted-skill",
          remotePath: "skills/deleted-skill",
        }),
      },
    });

    // Remote has no skills matching
    setupCloneMock(tmp, ["other-skill"]);

    // Should not throw
    await installFromLockfile(tmp, {});

    expect(existsSync(join(tmp, ".agents", "skills", "deleted-skill"))).toBe(false);
  });
});

describe("install (single repo)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "skilled-install-single-"));
    vi.mocked(shallowClone).mockReset();
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("installs all skills from a repo", async () => {
    setupCloneMock(tmp, ["build", "test"]);
    writeLockfile(tmp, { version: 1, skills: {} });

    await install("owner/repo", tmp);

    expect(existsSync(join(tmp, ".agents", "skills", "build", "SKILL.md"))).toBe(true);
    expect(existsSync(join(tmp, ".agents", "skills", "test", "SKILL.md"))).toBe(true);

    const lockfile = readLockfile(tmp);
    expect(lockfile.skills["build"]).toBeDefined();
    expect(lockfile.skills["test"]).toBeDefined();
  });

  it("installs only the specified skill", async () => {
    setupCloneMock(tmp, ["build", "test"]);
    writeLockfile(tmp, { version: 1, skills: {} });

    await install("owner/repo", tmp, { skill: "build" });

    expect(existsSync(join(tmp, ".agents", "skills", "build", "SKILL.md"))).toBe(true);
    expect(existsSync(join(tmp, ".agents", "skills", "test", "SKILL.md"))).toBe(false);
  });

  it("throws when specified skill does not exist in remote", async () => {
    setupCloneMock(tmp, ["build"]);
    writeLockfile(tmp, { version: 1, skills: {} });

    await expect(
      install("owner/repo", tmp, { skill: "nonexistent" }),
    ).rejects.toThrow('Skill "nonexistent" not found');
  });

  it("refuses to overwrite without --force", async () => {
    const existingDir = join(tmp, ".agents", "skills", "build");
    mkdirSync(existingDir, { recursive: true });
    writeFileSync(join(existingDir, "SKILL.md"), "existing");

    setupCloneMock(tmp, ["build"]);
    writeLockfile(tmp, { version: 1, skills: {} });

    await install("owner/repo", tmp, { skill: "build" });

    expect(readFileSync(join(existingDir, "SKILL.md"), "utf-8")).toBe(
      "existing",
    );
  });

  it("overwrites with --force", async () => {
    const existingDir = join(tmp, ".agents", "skills", "build");
    mkdirSync(existingDir, { recursive: true });
    writeFileSync(join(existingDir, "SKILL.md"), "existing");

    setupCloneMock(tmp, ["build"]);
    writeLockfile(tmp, { version: 1, skills: {} });

    await install("owner/repo", tmp, { skill: "build", force: true });

    const content = readFileSync(join(existingDir, "SKILL.md"), "utf-8");
    expect(content).toContain("Content for build");
  });

  it("throws when remote has no skills/ directory", async () => {
    const remoteDir = join(tmp, "_remote");
    mkdirSync(remoteDir, { recursive: true });
    // No skills/ dir

    vi.mocked(shallowClone).mockResolvedValue({
      dir: remoteDir,
      headSha: FAKE_SHA,
      cleanup: vi.fn(),
    });
    writeLockfile(tmp, { version: 1, skills: {} });

    await expect(install("owner/repo", tmp)).rejects.toThrow(
      "No skills/ directory found",
    );
  });

  it("records agents in lockfile when --agent is specified", async () => {
    const { resolveAgentTypes } = await import("../../src/core/agents.js");
    vi.mocked(resolveAgentTypes).mockReturnValue(["claude-code"] as any);

    setupCloneMock(tmp, ["build"]);
    writeLockfile(tmp, { version: 1, skills: {} });

    await install("owner/repo", tmp, { agent: ["claude-code"] });

    const lockfile = readLockfile(tmp);
    expect(lockfile.skills["build"].agents).toEqual(["claude-code"]);
  });
});
