import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  lstatSync,
  readlinkSync,
  symlinkSync,
} from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import {
  distributeSkill,
  distributeAllSkills,
  removeSkillLinks,
  getCustomDirs,
} from "../../src/core/distribute.js";
import { writeLockfile } from "../../src/core/manifest.js";
import { log } from "../../src/utils/logger.js";
import type { AgentType } from "../../src/core/agents.js";

describe("distribute", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "skilled-distribute-"));
    // Create canonical dir with a skill
    const skillDir = join(tmp, ".agents", "skills", "build");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "build skill content");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  describe("distributeSkill", () => {
    it("creates symlink for non-universal agent", () => {
      distributeSkill(tmp, "build", ["claude-code"] as AgentType[]);

      const linkPath = join(tmp, ".claude", "skills", "build");
      expect(existsSync(linkPath)).toBe(true);

      const stat = lstatSync(linkPath);
      expect(stat.isSymbolicLink()).toBe(true);
    });

    it("symlink points to canonical via relative path", () => {
      distributeSkill(tmp, "build", ["claude-code"] as AgentType[]);

      const linkPath = join(tmp, ".claude", "skills", "build");
      const target = readlinkSync(linkPath);
      // Should be a relative path like ../../.agents/skills/build
      expect(target).toBe(relative(
        join(tmp, ".claude", "skills"),
        join(tmp, ".agents", "skills", "build"),
      ));
    });

    it("skips universal agents (no symlink needed)", () => {
      distributeSkill(tmp, "build", ["amp", "cursor", "copilot"] as AgentType[]);

      // None of these should create symlinks since they all use .agents/skills
      expect(existsSync(join(tmp, ".agents", "skills", "build"))).toBe(true); // canonical exists
      // No extra symlinks created
      const stat = lstatSync(join(tmp, ".agents", "skills", "build"));
      expect(stat.isSymbolicLink()).toBe(false); // canonical is a real directory
    });

    it("creates symlinks for multiple non-universal agents", () => {
      distributeSkill(tmp, "build", ["claude-code", "windsurf"] as AgentType[]);

      expect(existsSync(join(tmp, ".claude", "skills", "build"))).toBe(true);
      expect(existsSync(join(tmp, ".windsurf", "skills", "build"))).toBe(true);

      expect(lstatSync(join(tmp, ".claude", "skills", "build")).isSymbolicLink()).toBe(true);
      expect(lstatSync(join(tmp, ".windsurf", "skills", "build")).isSymbolicLink()).toBe(true);
    });

    it("includes custom directories", () => {
      distributeSkill(tmp, "build", [] as AgentType[], ["custom-agent/skills"]);

      const linkPath = join(tmp, "custom-agent", "skills", "build");
      expect(existsSync(linkPath)).toBe(true);
      expect(lstatSync(linkPath).isSymbolicLink()).toBe(true);
    });

    // Bug 3: broken (dangling) symlinks must be replaced, not cause EEXIST
    it("replaces a pre-existing broken (dangling) symlink", () => {
      const linkDir = join(tmp, ".claude", "skills");
      mkdirSync(linkDir, { recursive: true });
      const linkPath = join(linkDir, "build");

      // Create a symlink pointing to a target that does not exist
      symlinkSync("/nonexistent/target", linkPath);

      // existsSync returns false for dangling symlinks — confirm the setup
      expect(existsSync(linkPath)).toBe(false);
      expect(lstatSync(linkPath).isSymbolicLink()).toBe(true);

      // Must not throw EEXIST — should replace the broken link
      expect(() => distributeSkill(tmp, "build", ["claude-code"] as AgentType[])).not.toThrow();

      // Link must now point to the correct canonical path
      const stat = lstatSync(linkPath);
      expect(stat.isSymbolicLink()).toBe(true);
      const target = readlinkSync(linkPath);
      expect(target).toBe(relative(linkDir, join(tmp, ".agents", "skills", "build")));
    });

    it("is idempotent — re-running does not fail", () => {
      distributeSkill(tmp, "build", ["claude-code"] as AgentType[]);
      distributeSkill(tmp, "build", ["claude-code"] as AgentType[]);

      const linkPath = join(tmp, ".claude", "skills", "build");
      expect(lstatSync(linkPath).isSymbolicLink()).toBe(true);
    });

    it("does nothing if canonical skill does not exist", () => {
      distributeSkill(tmp, "nonexistent", ["claude-code"] as AgentType[]);
      expect(existsSync(join(tmp, ".claude", "skills", "nonexistent"))).toBe(false);
    });
  });

  describe("distributeAllSkills", () => {
    it("distributes all skills in canonical dir", () => {
      // Add a second skill
      const testDir = join(tmp, ".agents", "skills", "test");
      mkdirSync(testDir, { recursive: true });
      writeFileSync(join(testDir, "SKILL.md"), "test skill");

      distributeAllSkills(tmp, ["claude-code"] as AgentType[]);

      expect(existsSync(join(tmp, ".claude", "skills", "build"))).toBe(true);
      expect(existsSync(join(tmp, ".claude", "skills", "test"))).toBe(true);
    });

    it("warns when canonical directory does not exist", () => {
      // Use a fresh tmp with no .agents/skills
      const emptyTmp = mkdtempSync(join(tmpdir(), "skilled-dist-empty-"));
      const warnSpy = vi.spyOn(log, "warn");
      try {
        distributeAllSkills(emptyTmp, ["claude-code"] as AgentType[]);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("No canonical skills directory found"),
        );
      } finally {
        warnSpy.mockRestore();
        rmSync(emptyTmp, { recursive: true, force: true });
      }
    });

    it("warns when canonical directory exists but has no skills", () => {
      const emptyTmp = mkdtempSync(join(tmpdir(), "skilled-dist-noskills-"));
      mkdirSync(join(emptyTmp, ".agents", "skills"), { recursive: true });
      const warnSpy = vi.spyOn(log, "warn");
      try {
        distributeAllSkills(emptyTmp, ["claude-code"] as AgentType[]);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("No skills found in .agents/skills"),
        );
      } finally {
        warnSpy.mockRestore();
        rmSync(emptyTmp, { recursive: true, force: true });
      }
    });

    it("logs an info message when all detected agents are universal (no symlinks needed)", () => {
      const infoSpy = vi.spyOn(log, "info");
      try {
        // "cursor" is a universal agent — uses .agents/skills directly
        distributeAllSkills(tmp, ["cursor"] as AgentType[]);
        expect(infoSpy).toHaveBeenCalledWith(
          expect.stringContaining("All detected agents"),
        );
      } finally {
        infoSpy.mockRestore();
      }
    });

    it("does not warn about missing symlinks when all agents are universal", () => {
      const warnSpy = vi.spyOn(log, "warn");
      try {
        distributeAllSkills(tmp, ["cursor", "copilot"] as AgentType[]);
        expect(warnSpy).not.toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
      }
    });

    it("warns about no agent dirs when agent list is empty and no custom dirs", () => {
      const warnSpy = vi.spyOn(log, "warn");
      try {
        distributeAllSkills(tmp, [] as AgentType[]);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("No agent directories to distribute to"),
        );
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  describe("removeSkillLinks", () => {
    it("removes symlinks from agent directories", () => {
      distributeSkill(tmp, "build", ["claude-code"] as AgentType[]);
      expect(existsSync(join(tmp, ".claude", "skills", "build"))).toBe(true);

      removeSkillLinks(tmp, "build", ["claude-code"] as AgentType[]);
      expect(existsSync(join(tmp, ".claude", "skills", "build"))).toBe(false);
    });

    it("does not remove real directories", () => {
      // Create a real directory (not a symlink)
      const realDir = join(tmp, ".claude", "skills", "build");
      mkdirSync(realDir, { recursive: true });
      writeFileSync(join(realDir, "SKILL.md"), "real content");

      removeSkillLinks(tmp, "build", ["claude-code"] as AgentType[]);
      // Should still exist since it's not a symlink
      expect(existsSync(realDir)).toBe(true);
    });

    it("removes symlinks from custom directories", () => {
      distributeSkill(tmp, "build", [] as AgentType[], ["custom/skills"]);
      expect(existsSync(join(tmp, "custom", "skills", "build"))).toBe(true);

      removeSkillLinks(tmp, "build", [] as AgentType[], ["custom/skills"]);
      expect(existsSync(join(tmp, "custom", "skills", "build"))).toBe(false);
    });
  });

  describe("getCustomDirs", () => {
    it("returns empty array when no lockfile exists", () => {
      expect(getCustomDirs(tmp)).toEqual([]);
    });

    it("returns empty array when lockfile has no customDirs", () => {
      writeLockfile(tmp, { version: 1, skills: {} });
      expect(getCustomDirs(tmp)).toEqual([]);
    });

    it("reads customDirs from lockfile", () => {
      writeLockfile(tmp, {
        version: 1,
        skills: {},
        customDirs: ["my-agent/skills"],
      });
      expect(getCustomDirs(tmp)).toEqual(["my-agent/skills"]);
    });
  });
});
