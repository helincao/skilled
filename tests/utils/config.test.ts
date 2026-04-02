import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { findProjectRoot, skillsDir, lockfilePath } from "../../src/utils/config.js";

describe("config utils", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "skilled-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  describe("findProjectRoot", () => {
    it("finds root by .git directory", () => {
      mkdirSync(join(tmp, ".git"));
      const nested = join(tmp, "a", "b", "c");
      mkdirSync(nested, { recursive: true });
      expect(findProjectRoot(nested)).toBe(tmp);
    });

    it("finds root by skills.lock.json", () => {
      writeFileSync(join(tmp, "skills.lock.json"), "{}");
      const nested = join(tmp, "deep");
      mkdirSync(nested, { recursive: true });
      expect(findProjectRoot(nested)).toBe(tmp);
    });

    it("returns starting directory when no markers found", () => {
      const isolated = mkdtempSync(join(tmpdir(), "no-root-"));
      try {
        expect(findProjectRoot(isolated)).toBe(isolated);
      } finally {
        rmSync(isolated, { recursive: true, force: true });
      }
    });
  });

  describe("skillsDir", () => {
    it("returns skills/ under root", () => {
      expect(skillsDir("/project")).toBe(join("/project", "skills"));
    });
  });

  describe("lockfilePath", () => {
    it("returns skills.lock.json under root", () => {
      expect(lockfilePath("/project")).toBe(join("/project", "skills.lock.json"));
    });
  });
});
