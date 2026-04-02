import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import simpleGit from "simple-git";
import { getChangedFiles, diffDirs, diffDirsFull } from "../../src/core/git.js";

describe("git", () => {
  let repoDir: string;

  beforeEach(async () => {
    repoDir = mkdtempSync(join(tmpdir(), "skilled-git-"));
    const git = simpleGit(repoDir);
    await git.init();
    await git.addConfig("user.email", "test@test.com");
    await git.addConfig("user.name", "Test");

    // Create an initial commit so we have a clean baseline
    writeFileSync(join(repoDir, "README.md"), "hello");
    await git.add(".");
    await git.commit("init");
  });

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  describe("getChangedFiles", () => {
    it("returns empty array when no changes", async () => {
      const result = await getChangedFiles(repoDir, "");
      expect(result).toEqual([]);
    });

    it("detects new untracked files in a path", async () => {
      mkdirSync(join(repoDir, "skills"), { recursive: true });
      writeFileSync(join(repoDir, "skills", "foo.md"), "content");
      const result = await getChangedFiles(repoDir, "skills");
      expect(result).toContain("skills/foo.md");
    });

    it("detects modified tracked files", async () => {
      const git = simpleGit(repoDir);
      mkdirSync(join(repoDir, "skills"), { recursive: true });
      writeFileSync(join(repoDir, "skills", "a.md"), "v1");
      await git.add(".");
      await git.commit("add skill");

      writeFileSync(join(repoDir, "skills", "a.md"), "v2");
      const result = await getChangedFiles(repoDir, "skills");
      expect(result).toContain("skills/a.md");
    });

    it("filters files by path prefix", async () => {
      writeFileSync(join(repoDir, "outside.txt"), "data");
      mkdirSync(join(repoDir, "skills"), { recursive: true });
      writeFileSync(join(repoDir, "skills", "inside.txt"), "data");

      const result = await getChangedFiles(repoDir, "skills");
      expect(result).toContain("skills/inside.txt");
      expect(result).not.toContain("outside.txt");
    });
  });

  describe("diffDirs", () => {
    let dirA: string;
    let dirB: string;

    beforeEach(() => {
      dirA = mkdtempSync(join(tmpdir(), "skilled-diff-a-"));
      dirB = mkdtempSync(join(tmpdir(), "skilled-diff-b-"));
    });

    afterEach(() => {
      rmSync(dirA, { recursive: true, force: true });
      rmSync(dirB, { recursive: true, force: true });
    });

    it("returns empty string for identical directories", async () => {
      writeFileSync(join(dirA, "file.txt"), "same");
      writeFileSync(join(dirB, "file.txt"), "same");
      const result = await diffDirs(dirA, dirB);
      expect(result.trim()).toBe("");
    });

    it("returns diff stat when directories differ", async () => {
      writeFileSync(join(dirA, "file.txt"), "version A");
      writeFileSync(join(dirB, "file.txt"), "version B");
      const result = await diffDirs(dirA, dirB);
      expect(result).toContain("file changed");
    });
  });

  describe("diffDirsFull", () => {
    let dirA: string;
    let dirB: string;

    beforeEach(() => {
      dirA = mkdtempSync(join(tmpdir(), "skilled-fulldiff-a-"));
      dirB = mkdtempSync(join(tmpdir(), "skilled-fulldiff-b-"));
    });

    afterEach(() => {
      rmSync(dirA, { recursive: true, force: true });
      rmSync(dirB, { recursive: true, force: true });
    });

    it("returns empty string for identical directories", async () => {
      writeFileSync(join(dirA, "file.txt"), "same");
      writeFileSync(join(dirB, "file.txt"), "same");
      const result = await diffDirsFull(dirA, dirB);
      expect(result.trim()).toBe("");
    });

    it("returns full patch diff when directories differ", async () => {
      writeFileSync(join(dirA, "file.txt"), "alpha\n");
      writeFileSync(join(dirB, "file.txt"), "beta\n");
      const result = await diffDirsFull(dirA, dirB);
      expect(result).toContain("alpha");
      expect(result).toContain("beta");
    });
  });
});
