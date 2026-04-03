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

  it("restores a skill whose lockfile remotePath is not under skills/ (non-standard layout)", async () => {
    writeLockfile(tmp, {
      version: 1,
      skills: {
        "deploy": makeEntry({
          name: "deploy",
          remotePath: "web-builder-skills/deploy",
        }),
      },
    });

    // Remote stores the skill under web-builder-skills/, not skills/
    const remoteDir = join(tmp, "_remote");
    const skillDir = join(remoteDir, "web-builder-skills", "deploy");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, "SKILL.md"),
      "---\nname: deploy\ndescription: Deploy skill\n---\nContent for deploy",
    );
    vi.mocked(shallowClone).mockResolvedValue({
      dir: remoteDir,
      headSha: FAKE_SHA,
      cleanup: vi.fn(),
    });

    await installFromLockfile(tmp, {});

    expect(existsSync(join(tmp, ".agents", "skills", "deploy", "SKILL.md"))).toBe(true);
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

  it("throws when remote has no skills at all (no skills/ dir, no SKILL.md anywhere)", async () => {
    const remoteDir = join(tmp, "_remote");
    mkdirSync(remoteDir, { recursive: true });
    // No skills/ dir and no SKILL.md files anywhere

    vi.mocked(shallowClone).mockResolvedValue({
      dir: remoteDir,
      headSha: FAKE_SHA,
      cleanup: vi.fn(),
    });
    writeLockfile(tmp, { version: 1, skills: {} });

    await expect(install("owner/repo", tmp)).rejects.toThrow(
      "No skills found in owner/repo",
    );
  });

  // ── Regression: non-standard remote layout ───────────────

  it("installs skills from a non-standard subdirectory (no skills/ at root)", async () => {
    // Simulates repos like helincao/skilled where skills live under web-builder-skills/
    const remoteDir = join(tmp, "_remote");
    const nonStandardDir = join(remoteDir, "web-builder-skills", "commit");
    mkdirSync(nonStandardDir, { recursive: true });
    writeFileSync(
      join(nonStandardDir, "SKILL.md"),
      "---\nname: commit\ndescription: Commit helper\n---\nContent",
    );

    vi.mocked(shallowClone).mockResolvedValue({
      dir: remoteDir,
      headSha: FAKE_SHA,
      cleanup: vi.fn(),
    });
    writeLockfile(tmp, { version: 1, skills: {} });

    await install("owner/repo", tmp);

    expect(
      existsSync(join(tmp, ".agents", "skills", "commit", "SKILL.md")),
    ).toBe(true);
  });

  it("always installs into .agents/skills/ regardless of remote subdirectory layout", async () => {
    const remoteDir = join(tmp, "_remote");
    // Skills are nested in non-standard subdirectories
    // Note: avoid names in SKIP_DIRS ("build", "dist", etc.) — those dirs are not traversed
    for (const [subdir, skill] of [
      ["web-builder-skills/deploy", "deploy"],
      ["tooling/review", "review"],
    ]) {
      const d = join(remoteDir, subdir);
      mkdirSync(d, { recursive: true });
      writeFileSync(join(d, "SKILL.md"), `---\nname: ${skill}\n---\n`);
    }

    vi.mocked(shallowClone).mockResolvedValue({
      dir: remoteDir,
      headSha: FAKE_SHA,
      cleanup: vi.fn(),
    });
    writeLockfile(tmp, { version: 1, skills: {} });

    await install("owner/repo", tmp);

    // Local layout must always be flat under .agents/skills/
    expect(existsSync(join(tmp, ".agents", "skills", "deploy", "SKILL.md"))).toBe(true);
    expect(existsSync(join(tmp, ".agents", "skills", "review", "SKILL.md"))).toBe(true);
    // Remote subdirectory structure must NOT be replicated locally
    expect(existsSync(join(tmp, ".agents", "skills", "web-builder-skills"))).toBe(false);
    expect(existsSync(join(tmp, ".agents", "skills", "tooling"))).toBe(false);
  });

  it("stores the actual relative remotePath in the lockfile (not hardcoded skills/)", async () => {
    const remoteDir = join(tmp, "_remote");
    const skillDir = join(remoteDir, "web-builder-skills", "deploy");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: deploy\n---\n");

    vi.mocked(shallowClone).mockResolvedValue({
      dir: remoteDir,
      headSha: FAKE_SHA,
      cleanup: vi.fn(),
    });
    writeLockfile(tmp, { version: 1, skills: {} });

    await install("owner/repo", tmp);

    const lockfile = readLockfile(tmp);
    expect(lockfile.skills["deploy"].remotePath).toBe("web-builder-skills/deploy");
  });

  it("--skill validation works against non-standard remote layout", async () => {
    const remoteDir = join(tmp, "_remote");
    const skillDir = join(remoteDir, "custom-skills", "lint");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: lint\n---\n");

    vi.mocked(shallowClone).mockResolvedValue({
      dir: remoteDir,
      headSha: FAKE_SHA,
      cleanup: vi.fn(),
    });
    writeLockfile(tmp, { version: 1, skills: {} });

    // Should succeed for an existing skill
    await install("owner/repo", tmp, { skill: "lint" });
    expect(existsSync(join(tmp, ".agents", "skills", "lint", "SKILL.md"))).toBe(true);

    // Should fail for a non-existent skill
    await expect(
      install("owner/repo", tmp, { skill: "nonexistent" }),
    ).rejects.toThrow('Skill "nonexistent" not found');
  });

  it("skips both skills and reports error when two remote subdirs share the same skill name", async () => {
    const remoteDir = join(tmp, "_remote");
    for (const subdir of ["group-a/commit", "group-b/commit"]) {
      const d = join(remoteDir, subdir);
      mkdirSync(d, { recursive: true });
      writeFileSync(join(d, "SKILL.md"), `---\nname: commit\n---\n`);
    }

    vi.mocked(shallowClone).mockResolvedValue({
      dir: remoteDir,
      headSha: FAKE_SHA,
      cleanup: vi.fn(),
    });
    writeLockfile(tmp, { version: 1, skills: {} });

    await install("owner/repo", tmp);

    // Neither conflicting skill should be installed
    expect(existsSync(join(tmp, ".agents", "skills", "commit"))).toBe(false);
    // Nothing in lockfile either
    const lockfile = readLockfile(tmp);
    expect(lockfile.skills["commit"]).toBeUndefined();
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
