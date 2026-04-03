import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  writeLockfile,
  type SkillEntry,
} from "../../src/core/manifest.js";
import { hashDirectory } from "../../src/core/hash.js";

// ── Mocks ────────────────────────────────────────────────
vi.mock("../../src/core/git.js", () => ({
  shallowClone: vi.fn(),
  diffDirs: vi.fn().mockResolvedValue(""),
}));

vi.mock("../../src/core/github.js", () => ({
  fetchTreeSha: vi.fn(),
}));

import { shallowClone, diffDirs } from "../../src/core/git.js";
import { fetchTreeSha } from "../../src/core/github.js";
import { check } from "../../src/commands/check.js";

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

describe("check command", () => {
  let tmp: string;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "skilled-check-"));
    mkdirSync(join(tmp, ".agents", "skills"), { recursive: true });
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(shallowClone).mockReset();
    vi.mocked(fetchTreeSha).mockReset();
    vi.mocked(diffDirs).mockReset();
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    consoleSpy.mockRestore();
  });

  it("returns empty array when no skills are tracked", async () => {
    writeLockfile(tmp, { version: 1, skills: {} });
    const results = await check(tmp, undefined, { json: true });
    expect(results).toEqual([]);
  });

  describe("fast path (with treeSha)", () => {
    it("reports up to date when nothing changed", async () => {
      const skillDir = join(tmp, ".agents", "skills", "my-skill");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "SKILL.md"), "content");
      const hash = hashDirectory(skillDir);

      writeLockfile(tmp, {
        version: 1,
        skills: {
          "my-skill": makeEntry({
            installedHash: hash,
            treeSha: "remote-tree-sha",
          }),
        },
      });

      vi.mocked(fetchTreeSha).mockResolvedValue({
        status: "ok",
        sha: "remote-tree-sha",
      });

      const results = await check(tmp, undefined, { json: true });
      expect(results).toHaveLength(1);
      expect(results[0].localModified).toBe(false);
      expect(results[0].remoteModified).toBe(false);
      expect(results[0].conflict).toBe(false);
      expect(results[0].detail).toBe("Up to date");
    });

    it("detects local modifications", async () => {
      const skillDir = join(tmp, ".agents", "skills", "my-skill");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "SKILL.md"), "modified content");

      writeLockfile(tmp, {
        version: 1,
        skills: {
          "my-skill": makeEntry({
            installedHash: "original-hash",
            treeSha: "remote-tree-sha",
          }),
        },
      });

      vi.mocked(fetchTreeSha).mockResolvedValue({
        status: "ok",
        sha: "remote-tree-sha",
      });

      const results = await check(tmp, undefined, { json: true });
      expect(results[0].localModified).toBe(true);
      expect(results[0].remoteModified).toBe(false);
      expect(results[0].detail).toContain("Local changes");
    });

    it("detects remote modifications", async () => {
      const skillDir = join(tmp, ".agents", "skills", "my-skill");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "SKILL.md"), "content");
      const hash = hashDirectory(skillDir);

      writeLockfile(tmp, {
        version: 1,
        skills: {
          "my-skill": makeEntry({
            installedHash: hash,
            treeSha: "old-remote-sha",
          }),
        },
      });

      vi.mocked(fetchTreeSha).mockResolvedValue({
        status: "ok",
        sha: "new-remote-sha",
      });

      const results = await check(tmp, undefined, { json: true });
      expect(results[0].localModified).toBe(false);
      expect(results[0].remoteModified).toBe(true);
      expect(results[0].detail).toContain("Remote has updates");
    });

    it("detects conflict when both changed", async () => {
      const skillDir = join(tmp, ".agents", "skills", "my-skill");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "SKILL.md"), "locally modified");

      writeLockfile(tmp, {
        version: 1,
        skills: {
          "my-skill": makeEntry({
            installedHash: "original-hash",
            treeSha: "old-remote-sha",
          }),
        },
      });

      vi.mocked(fetchTreeSha).mockResolvedValue({
        status: "ok",
        sha: "new-remote-sha",
      });

      const results = await check(tmp, undefined, { json: true });
      expect(results[0].localModified).toBe(true);
      expect(results[0].remoteModified).toBe(true);
      expect(results[0].conflict).toBe(true);
      expect(results[0].detail).toContain("CONFLICT");
    });

    it("handles missing local skill directory", async () => {
      writeLockfile(tmp, {
        version: 1,
        skills: {
          "my-skill": makeEntry({ treeSha: "remote-tree-sha" }),
        },
      });

      const results = await check(tmp, undefined, { json: true });
      expect(results[0].detail).toBe("Local skill directory missing");
    });

    it("handles rate-limited API response", async () => {
      const skillDir = join(tmp, ".agents", "skills", "my-skill");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "SKILL.md"), "content");
      const hash = hashDirectory(skillDir);

      writeLockfile(tmp, {
        version: 1,
        skills: {
          "my-skill": makeEntry({
            installedHash: hash,
            treeSha: "remote-tree-sha",
          }),
        },
      });

      vi.mocked(fetchTreeSha).mockResolvedValue({
        status: "rate_limited",
        resetsAt: "3:00 PM",
      });

      const results = await check(tmp, undefined, { json: true });
      // Remote modified should be false since we couldn't check
      expect(results[0].remoteModified).toBe(false);
    });
  });

  describe("clone-based fallback (no treeSha)", () => {
    function setupCloneFallback(tmp: string, skills: string[]) {
      const remoteDir = join(tmp, "_remote");
      const remoteSkillsDir = join(remoteDir, "skills");
      mkdirSync(remoteSkillsDir, { recursive: true });

      for (const name of skills) {
        const skillDir = join(remoteSkillsDir, name);
        mkdirSync(skillDir, { recursive: true });
        writeFileSync(join(skillDir, "SKILL.md"), `content for ${name}`);
      }

      vi.mocked(shallowClone).mockResolvedValue({
        dir: remoteDir,
        headSha: "new-sha-1234567",
        cleanup: vi.fn(),
      });
    }

    it("reports up to date when no diff", async () => {
      const skillDir = join(tmp, ".agents", "skills", "my-skill");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "SKILL.md"), "content");
      const hash = hashDirectory(skillDir);

      writeLockfile(tmp, {
        version: 1,
        skills: {
          "my-skill": makeEntry({ installedHash: hash }),
          // No treeSha → triggers clone-based check
        },
      });

      setupCloneFallback(tmp, ["my-skill"]);
      vi.mocked(diffDirs).mockResolvedValue("");

      const results = await check(tmp, undefined, { json: true });
      expect(results[0].detail).toBe("Up to date");
    });

    it("detects remote changes via diff", async () => {
      const skillDir = join(tmp, ".agents", "skills", "my-skill");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "SKILL.md"), "content");
      const hash = hashDirectory(skillDir);

      writeLockfile(tmp, {
        version: 1,
        skills: {
          "my-skill": makeEntry({ installedHash: hash }),
        },
      });

      setupCloneFallback(tmp, ["my-skill"]);
      vi.mocked(diffDirs).mockResolvedValue("--- a/SKILL.md\n+++ b/SKILL.md\n");

      const results = await check(tmp, undefined, { json: true });
      expect(results[0].remoteModified).toBe(true);
    });

    it("handles missing local directory in clone path", async () => {
      writeLockfile(tmp, {
        version: 1,
        skills: { "my-skill": makeEntry() },
      });

      setupCloneFallback(tmp, ["my-skill"]);

      const results = await check(tmp, undefined, { json: true });
      expect(results[0].detail).toBe("Local skill directory missing");
    });
  });

  it("checks only the named skill when specified", async () => {
    const skillDir = join(tmp, ".agents", "skills", "skill-a");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "content");
    const hash = hashDirectory(skillDir);

    writeLockfile(tmp, {
      version: 1,
      skills: {
        "skill-a": makeEntry({
          name: "skill-a",
          remotePath: "skills/skill-a",
          installedHash: hash,
          treeSha: "remote-sha",
        }),
        "skill-b": makeEntry({
          name: "skill-b",
          remotePath: "skills/skill-b",
          treeSha: "remote-sha-b",
        }),
      },
    });

    vi.mocked(fetchTreeSha).mockResolvedValue({
      status: "ok",
      sha: "remote-sha",
    });

    const results = await check(tmp, "skill-a", { json: true });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("skill-a");
  });
});
