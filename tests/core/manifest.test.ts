import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readLockfile,
  writeLockfile,
  getSkillEntry,
  setSkillEntry,
  removeSkillEntry,
  acquireLock,
  type SkillEntry,
  type Lockfile,
} from "../../src/core/manifest.js";

function makeEntry(overrides: Partial<SkillEntry> = {}): SkillEntry {
  return {
    name: "build",
    repo: "helincao/skilled",
    remotePath: "skills/build",
    commitSha: "abc123",
    syncedAt: "2025-01-01T00:00:00.000Z",
    installedHash: "deadbeef12345678",
    ...overrides,
  };
}

describe("manifest", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "skilled-manifest-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  describe("readLockfile", () => {
    it("returns empty lockfile when file does not exist", () => {
      const lf = readLockfile(tmp);
      expect(lf).toEqual({ version: 1, skills: {} });
    });

    it("reads existing lockfile", () => {
      const data: Lockfile = {
        version: 1,
        skills: { build: makeEntry() },
      };
      writeFileSync(
        join(tmp, "skills.lock.json"),
        JSON.stringify(data),
      );
      const lf = readLockfile(tmp);
      expect(lf.skills.build.name).toBe("build");
    });
  });

  describe("writeLockfile", () => {
    it("writes lockfile as formatted JSON", () => {
      const lf: Lockfile = { version: 1, skills: { build: makeEntry() } };
      writeLockfile(tmp, lf);
      const raw = readFileSync(join(tmp, "skills.lock.json"), "utf-8");
      expect(raw).toContain('"version": 1');
      expect(raw.endsWith("\n")).toBe(true);
      expect(JSON.parse(raw)).toEqual(lf);
    });
  });

  describe("getSkillEntry", () => {
    it("returns undefined for missing skill", () => {
      expect(getSkillEntry(tmp, "nonexistent")).toBeUndefined();
    });

    it("returns entry when present", () => {
      const lf: Lockfile = { version: 1, skills: { build: makeEntry() } };
      writeLockfile(tmp, lf);
      expect(getSkillEntry(tmp, "build")?.name).toBe("build");
    });
  });

  describe("setSkillEntry", () => {
    it("adds a new entry", () => {
      setSkillEntry(tmp, makeEntry());
      const lf = readLockfile(tmp);
      expect(lf.skills.build).toBeDefined();
    });

    it("updates an existing entry", () => {
      setSkillEntry(tmp, makeEntry());
      setSkillEntry(tmp, makeEntry({ commitSha: "new-sha" }));
      const lf = readLockfile(tmp);
      expect(lf.skills.build.commitSha).toBe("new-sha");
    });
  });

  describe("removeSkillEntry", () => {
    it("removes an existing entry", () => {
      setSkillEntry(tmp, makeEntry());
      removeSkillEntry(tmp, "build");
      const lf = readLockfile(tmp);
      expect(lf.skills.build).toBeUndefined();
    });

    it("is a no-op for missing entry", () => {
      removeSkillEntry(tmp, "nonexistent");
      const lf = readLockfile(tmp);
      expect(Object.keys(lf.skills)).toHaveLength(0);
    });
  });

  describe("atomic writes", () => {
    it("produces a valid lockfile after write", () => {
      const lf: Lockfile = { version: 1, skills: { build: makeEntry() } };
      writeLockfile(tmp, lf);
      const raw = readFileSync(join(tmp, "skills.lock.json"), "utf-8");
      expect(JSON.parse(raw)).toEqual(lf);
    });

    it("does not leave temp files on success", () => {
      const lf: Lockfile = { version: 1, skills: { build: makeEntry() } };
      writeLockfile(tmp, lf);
      const files = require("node:fs").readdirSync(tmp);
      const tmpFiles = files.filter((f: string) => f.includes(".tmp"));
      expect(tmpFiles).toHaveLength(0);
    });
  });

  describe("readLockfile error handling", () => {
    it("throws on corrupted JSON", () => {
      writeFileSync(join(tmp, "skills.lock.json"), "not valid json{{{");
      expect(() => readLockfile(tmp)).toThrow("Corrupted lockfile");
    });
  });

  describe("acquireLock", () => {
    it("acquires and releases lock", () => {
      const release = acquireLock(tmp);
      expect(existsSync(join(tmp, "skills.lock.json.lock"))).toBe(true);
      release();
      expect(existsSync(join(tmp, "skills.lock.json.lock"))).toBe(false);
    });

    it("throws when lock already held", () => {
      const release = acquireLock(tmp);
      try {
        expect(() => acquireLock(tmp)).toThrow("Another skilled process");
      } finally {
        release();
      }
    });

    it("removes stale locks older than 5 minutes", () => {
      const lockPath = join(tmp, "skills.lock.json.lock");
      writeFileSync(
        lockPath,
        JSON.stringify({ pid: 99999, timestamp: Date.now() - 6 * 60 * 1000 }),
      );
      // Should succeed because the lock is stale
      const release = acquireLock(tmp);
      release();
    });

    it("registers an exit listener that cleans up the lock file", () => {
      const listenersBefore = process.listenerCount("exit");
      const release = acquireLock(tmp);
      expect(process.listenerCount("exit")).toBe(listenersBefore + 1);
      release();
      // After release, the exit listener should be gone
      expect(process.listenerCount("exit")).toBe(listenersBefore);
    });

    it("registers SIGINT and SIGTERM listeners while lock is held", () => {
      const sigintBefore = process.listenerCount("SIGINT");
      const sigtermBefore = process.listenerCount("SIGTERM");

      const release = acquireLock(tmp);
      expect(process.listenerCount("SIGINT")).toBe(sigintBefore + 1);
      expect(process.listenerCount("SIGTERM")).toBe(sigtermBefore + 1);

      release();
      expect(process.listenerCount("SIGINT")).toBe(sigintBefore);
      expect(process.listenerCount("SIGTERM")).toBe(sigtermBefore);
    });

    it("calling release() a second time is a no-op (idempotent)", () => {
      const release = acquireLock(tmp);
      release();
      expect(existsSync(join(tmp, "skills.lock.json.lock"))).toBe(false);
      // Second call must not throw
      expect(() => release()).not.toThrow();
    });

    it("exit handler removes the lock file when invoked directly", () => {
      const lockPath = join(tmp, "skills.lock.json.lock");
      const listenersBefore = process.listenerCount("exit");

      acquireLock(tmp);
      expect(existsSync(lockPath)).toBe(true);

      // Simulate the exit event by invoking the registered listener
      const handlers = process.listeners("exit");
      const newHandler = handlers[handlers.length - 1] as () => void;
      newHandler();

      expect(existsSync(lockPath)).toBe(false);

      // Clean up — remove the now-stale listener count
      process.removeListener("exit", newHandler);
      expect(process.listenerCount("exit")).toBe(listenersBefore);
    });
  });
});
