import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { log } from "../utils/logger.js";

/**
 * Directories to skip when recursively discovering skills.
 * Must stay in sync across search, install, and any other commands
 * that perform recursive skill discovery.
 */
export const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "__pycache__",
]);

export const MAX_DEPTH = 5;

/**
 * Recursively discover directories containing a SKILL.md file.
 * Used as a fallback when the standard skills/ directory is missing or empty.
 */
export function findSkillDirs(dir: string, depth = 0): string[] {
  if (depth > MAX_DEPTH) return [];

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    const results: string[] = [];

    if (existsSync(join(dir, "SKILL.md"))) {
      results.push(dir);
    }

    for (const entry of entries) {
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
        results.push(...findSkillDirs(join(dir, entry.name), depth + 1));
      }
    }

    return results;
  } catch (err) {
    log.warn(`Could not read directory ${dir}: ${(err as Error).message}`);
    return [];
  }
}
