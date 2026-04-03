import {
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { lockfilePath } from "../utils/config.js";

export interface SkillEntry {
  /** Skill name (directory name) */
  name: string;
  /** Source repository in "owner/repo" format */
  repo: string;
  /** Path within the source repo (e.g. "skills/build") */
  remotePath: string;
  /** Commit SHA at time of install/last sync */
  commitSha: string;
  /** ISO date of install/last sync */
  syncedAt: string;
  /** SHA-256 hash of local skill content at install time */
  installedHash: string;
  /** GitHub tree SHA for the skill folder (used for fast remote change detection) */
  treeSha?: string;
  /** Agent systems this skill is installed for */
  agents?: string[];
}

export interface Lockfile {
  version: 1;
  skills: Record<string, SkillEntry>;
  /** User-configured additional directories to symlink skills into */
  customDirs?: string[];
}

export function readLockfile(root: string): Lockfile {
  const path = lockfilePath(root);
  if (!existsSync(path)) {
    return { version: 1, skills: {} };
  }
  const raw = readFileSync(path, "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(
      `Corrupted lockfile at ${path}. Delete it and re-install skills, or restore from git.`,
    );
  }
}

/**
 * Write lockfile atomically: write to a temp file in the same directory,
 * then rename. rename() is atomic on the same filesystem, so a crash
 * mid-write cannot corrupt the real lockfile.
 */
export function writeLockfile(root: string, lockfile: Lockfile): void {
  const path = lockfilePath(root);
  const tmpPath = join(dirname(path), `.skills.lock.json.${process.pid}.tmp`);
  try {
    writeFileSync(tmpPath, JSON.stringify(lockfile, null, 2) + "\n");
    renameSync(tmpPath, path);
  } catch (err) {
    // Clean up temp file on failure
    try {
      unlinkSync(tmpPath);
    } catch {
      // ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Acquire a simple filesystem lock to prevent concurrent lockfile access.
 * Returns a release function. Uses O_EXCL for atomic creation.
 */
export function acquireLock(root: string): () => void {
  const path = lockfilePath(root) + ".lock";

  // Check for stale lock (older than 5 minutes)
  if (existsSync(path)) {
    try {
      const content = readFileSync(path, "utf-8");
      const { pid, timestamp } = JSON.parse(content);
      const staleMs = 5 * 60 * 1000;
      if (Date.now() - timestamp > staleMs) {
        unlinkSync(path);
      } else {
        throw new Error(
          `Another skilled process (pid ${pid}) is running. ` +
            `If this is incorrect, delete ${path}`,
        );
      }
    } catch (err) {
      if ((err as Error).message.includes("Another skilled process")) throw err;
      // Corrupt lock file — remove it
      try { unlinkSync(path); } catch { /* ignore */ }
    }
  }

  try {
    writeFileSync(path, JSON.stringify({ pid: process.pid, timestamp: Date.now() }), {
      flag: "wx", // O_CREAT | O_EXCL — fails if file exists
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(
        `Another skilled process is running. If this is incorrect, delete ${path}`,
      );
    }
    throw err;
  }

  return () => {
    try {
      unlinkSync(path);
    } catch {
      // ignore — lock may have been cleaned up already
    }
  };
}

export function getSkillEntry(
  root: string,
  name: string,
): SkillEntry | undefined {
  const lockfile = readLockfile(root);
  return lockfile.skills[name];
}

export function setSkillEntry(root: string, entry: SkillEntry): void {
  const lockfile = readLockfile(root);
  lockfile.skills[entry.name] = entry;
  writeLockfile(root, lockfile);
}

export function removeSkillEntry(root: string, name: string): void {
  const lockfile = readLockfile(root);
  delete lockfile.skills[name];
  writeLockfile(root, lockfile);
}
