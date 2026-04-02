import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { resolveRepo, findSkillsRoot } from "../core/resolver.js";
import { shallowClone } from "../core/git.js";
import { parseSkillMeta, type SkillMeta } from "../core/skill-parser.js";
import { log } from "../utils/logger.js";

export interface SearchOptions {
  json?: boolean;
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "__pycache__"]);
const MAX_DEPTH = 5;

/**
 * Recursively discover directories containing a SKILL.md file.
 * Used as a fallback when the standard skills/ directory is missing or empty.
 */
function findSkillDirs(dir: string, depth = 0): string[] {
  if (depth > MAX_DEPTH) return [];

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    const results: string[] = [];

    // Check if this directory itself is a skill
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

export async function search(
  repoRef: string,
  query?: string,
  opts: SearchOptions = {},
): Promise<void> {
  const resolved = resolveRepo(repoRef);

  if (!opts.json) {
    log.step(`Fetching skills from ${resolved.slug}...`);
  }

  const clone = await shallowClone(resolved.cloneUrl);

  try {
    const remoteSkillsDir = findSkillsRoot(clone.dir);

    let skills: SkillMeta[] = [];

    // Primary: look in the standard skills/ directory
    if (existsSync(remoteSkillsDir)) {
      const dirs = readdirSync(remoteSkillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory());

      for (const d of dirs) {
        const info = parseSkillMeta(join(remoteSkillsDir, d.name));
        if (info) {
          skills.push(info);
        } else {
          skills.push({ name: d.name, description: "" });
        }
      }
    }

    // Fallback: recursively search the repo if skills/ was missing or empty
    if (skills.length === 0) {
      const seenNames = new Set<string>();
      const skillDirs = findSkillDirs(clone.dir);

      for (const skillDir of skillDirs) {
        const info = parseSkillMeta(skillDir);
        if (info && !seenNames.has(info.name)) {
          seenNames.add(info.name);
          skills.push(info);
        }
      }
    }

    // Filter by query if provided
    if (query) {
      const q = query.toLowerCase();
      skills = skills.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q),
      );
    }

    if (opts.json) {
      console.log(JSON.stringify(skills, null, 2));
      return;
    }

    if (skills.length === 0) {
      log.info(
        query
          ? `No skills matching "${query}" in ${resolved.slug}.`
          : `No skills found in ${resolved.slug}.`,
      );
      return;
    }

    console.log();
    console.log(
      chalk.bold(
        query
          ? `Skills matching "${query}" in ${resolved.slug}:`
          : `Available skills in ${resolved.slug}:`,
      ),
    );
    console.log();

    for (const s of skills) {
      const desc = s.description
        ? chalk.dim(` — ${s.description}`)
        : "";
      console.log(`  ${chalk.cyan(s.name)}${desc}`);
    }

    console.log();
    log.dim(
      `Install with: skilled install ${resolved.slug} --skill <name>`,
    );
  } finally {
    clone.cleanup();
  }
}
