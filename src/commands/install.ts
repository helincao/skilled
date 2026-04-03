import { existsSync, cpSync, mkdirSync, readdirSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { resolveRepo, findSkillsRoot } from "../core/resolver.js";
import { shallowClone, type CloneResult } from "../core/git.js";
import {
  setSkillEntry,
  acquireLock,
  readLockfile,
} from "../core/manifest.js";
import { fetchTreeSha } from "../core/github.js";
import { hashDirectory } from "../core/hash.js";
import { skillsDir } from "../utils/config.js";
import { log } from "../utils/logger.js";
import {
  type AgentType,
  detectAgents,
  resolveAgentTypes,
} from "../core/agents.js";
import { sanitizeName, isPathSafe } from "../utils/sanitize.js";
import { distributeSkill, getCustomDirs } from "../core/distribute.js";
import type { ResolvedRepo } from "../core/resolver.js";

export interface InstallOptions {
  skill?: string;
  force?: boolean;
  agent?: string[];
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "__pycache__"]);
const MAX_DEPTH = 5;

/** Recursively find directories containing a SKILL.md file. */
function findSkillDirs(dir: string, depth = 0): string[] {
  if (depth > MAX_DEPTH) return [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    const results: string[] = [];
    if (existsSync(join(dir, "SKILL.md"))) results.push(dir);
    for (const entry of entries) {
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
        results.push(...findSkillDirs(join(dir, entry.name), depth + 1));
      }
    }
    return results;
  } catch {
    return [];
  }
}

interface DiscoveryResult {
  skills: Map<string, string>;
  /** True when skills were found but ALL were excluded due to name collisions. */
  allConflicted: boolean;
}

/**
 * Build a map of skillName → absolute path for all skills in a cloned repo.
 * Prefers the standard `skills/` subdirectory; falls back to recursive discovery.
 */
function discoverSkillDirs(cloneDir: string): DiscoveryResult {
  const standardDir = findSkillsRoot(cloneDir);
  if (existsSync(standardDir)) {
    const entries = readdirSync(standardDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());
    if (entries.length > 0) {
      return {
        skills: new Map(entries.map((d) => [d.name, join(standardDir, d.name)])),
        allConflicted: false,
      };
    }
  }
  // Fallback: recursively find any directory containing a SKILL.md
  const found = findSkillDirs(cloneDir);

  // Detect name collisions: two skill dirs with the same basename
  const seen = new Map<string, string>();
  const conflicted = new Set<string>();
  for (const d of found) {
    const name = basename(d);
    if (seen.has(name)) {
      conflicted.add(name);
    } else {
      seen.set(name, d);
    }
  }
  for (const name of conflicted) {
    log.error(
      `Skipping skill "${name}" — found at multiple paths in the remote repo. ` +
      `Use --skill with a repo that has a unique skills/ layout.`,
    );
    seen.delete(name);
  }
  return {
    skills: seen,
    allConflicted: found.length > 0 && seen.size === 0,
  };
}

/**
 * Install skills from a cloned repo. Shared by both `install` (single repo)
 * and `installFromLockfile` (restore all).
 */
async function installFromClone(
  resolved: ResolvedRepo,
  clone: CloneResult,
  root: string,
  skillNames: string[] | undefined,
  agents: AgentType[],
  opts: { force?: boolean },
): Promise<void> {
  const { skills: availableMap, allConflicted } = discoverSkillDirs(clone.dir);

  if (availableMap.size === 0 && !allConflicted) {
    throw new Error(`No skills found in ${resolved.slug}.`);
  }

  const available = Array.from(availableMap.keys());
  const toInstall = skillNames ?? available;

  for (const name of toInstall) {
    if (!available.includes(name)) {
      log.warn(
        `Skill "${name}" not found in ${resolved.slug}. Skipping. Available: ${available.join(", ")}`,
      );
      continue;
    }

    const safeName = sanitizeName(name);
    const localSkillsPath = skillsDir(root);
    if (!isPathSafe(localSkillsPath, safeName)) {
      log.warn(`Skipping "${name}" — unsafe path detected.`);
      continue;
    }

    const src = availableMap.get(name)!;
    const dest = join(localSkillsPath, safeName);

    if (existsSync(dest) && !opts.force) {
      log.warn(
        `Skill "${safeName}" already exists locally. Use --force to overwrite.`,
      );
      continue;
    }

    cpSync(src, dest, { recursive: true });

    const contentHash = hashDirectory(dest);
    const remotePath = relative(clone.dir, src);

    const treeSha = await fetchTreeSha(
      resolved.owner,
      resolved.repo,
      remotePath,
    );

    setSkillEntry(root, {
      name: safeName,
      repo: resolved.slug,
      remotePath,
      commitSha: clone.headSha,
      syncedAt: new Date().toISOString(),
      installedHash: contentHash,
      treeSha: treeSha ?? undefined,
      agents: agents.length > 0 ? agents : undefined,
    });

    // Distribute to agent-specific directories via symlinks
    distributeSkill(root, safeName, agents, getCustomDirs(root));

    log.success(`Installed ${safeName} (${clone.headSha.slice(0, 7)})`);
  }
}

export async function install(
  repoRef: string,
  root: string,
  opts: InstallOptions = {},
): Promise<void> {
  const resolved = resolveRepo(repoRef);
  const releaseLock = acquireLock(root);

  log.step(`Cloning ${resolved.slug}...`);

  const clone = await shallowClone(resolved.cloneUrl);

  try {
    const agents: AgentType[] = opts.agent
      ? resolveAgentTypes(opts.agent)
      : detectAgents(root);

    mkdirSync(skillsDir(root), { recursive: true });

    const skillNames = opts.skill ? [opts.skill] : undefined;

    if (opts.skill) {
      // Validate early when a specific skill is requested
      const available = Array.from(discoverSkillDirs(clone.dir).skills.keys());
      if (!available.includes(opts.skill)) {
        throw new Error(
          `Skill "${opts.skill}" not found in ${resolved.slug}. Available: ${available.join(", ")}`,
        );
      }
    }

    await installFromClone(resolved, clone, root, skillNames, agents, opts);

  } finally {
    clone.cleanup();
    releaseLock();
  }
}

/**
 * Restore all skills tracked in skills.lock.json.
 * Groups entries by repo to minimise clones.
 */
export async function installFromLockfile(
  root: string,
  opts: Omit<InstallOptions, "skill"> = {},
): Promise<void> {
  const lockfile = readLockfile(root);
  const entries = Object.values(lockfile.skills);

  if (entries.length === 0) {
    log.warn("No skills found in lockfile. Nothing to install.");
    return;
  }

  // Group by repo so we only clone each repo once
  const byRepo = new Map<string, typeof entries>();
  for (const entry of entries) {
    const group = byRepo.get(entry.repo) ?? [];
    group.push(entry);
    byRepo.set(entry.repo, group);
  }

  log.step(
    `Restoring ${entries.length} skill(s) from ${byRepo.size} repo(s)...`,
  );

  const releaseLock = acquireLock(root);

  try {
    const agents: AgentType[] = opts.agent
      ? resolveAgentTypes(opts.agent)
      : detectAgents(root);

    mkdirSync(skillsDir(root), { recursive: true });

    for (const [repo, skills] of byRepo) {
      const resolved = resolveRepo(repo);
      log.step(`Cloning ${resolved.slug}...`);
      const clone = await shallowClone(resolved.cloneUrl);

      try {
        const skillNames = skills.map((s) => basename(s.remotePath));
        await installFromClone(resolved, clone, root, skillNames, agents, opts);
      } finally {
        clone.cleanup();
      }
    }

  } finally {
    releaseLock();
  }
}
