import {
  existsSync,
  mkdirSync,
  symlinkSync,
  lstatSync,
  readlinkSync,
  unlinkSync,
  readdirSync,
} from "node:fs";
import { join, relative, dirname } from "node:path";
import { type AgentType, getSymlinkTargets, UNIVERSAL_AGENTS } from "./agents.js";
import { readLockfile } from "./manifest.js";
import { skillsDir } from "../utils/config.js";
import { log } from "../utils/logger.js";

/** Read customDirs from the lockfile */
export function getCustomDirs(root: string): string[] {
  return readLockfile(root).customDirs ?? [];
}

/**
 * Create a relative symlink from `linkPath` pointing to `target`.
 * If the link already exists and points to the correct target, this is a no-op.
 * On Windows, uses junctions as a fallback.
 */
function createRelativeSymlink(target: string, linkPath: string): boolean {
  const linkDir = dirname(linkPath);
  const rel = relative(linkDir, target);

  if (existsSync(linkPath)) {
    try {
      const stat = lstatSync(linkPath);
      if (stat.isSymbolicLink()) {
        const existing = readlinkSync(linkPath);
        if (existing === rel) return true; // already correct
        unlinkSync(linkPath); // wrong target, replace
      } else {
        // It's a real directory/file — don't clobber it
        log.warn(`Skipping ${linkPath} — exists and is not a symlink`);
        return false;
      }
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ELOOP") {
        // Circular symlink — clean up
        unlinkSync(linkPath);
      } else {
        throw err;
      }
    }
  }

  mkdirSync(linkDir, { recursive: true });

  try {
    symlinkSync(rel, linkPath);
    return true;
  } catch (err: unknown) {
    // On Windows, try junction as fallback
    if ((err as NodeJS.ErrnoException).code === "EPERM" && process.platform === "win32") {
      try {
        symlinkSync(target, linkPath, "junction");
        return true;
      } catch {
        return false;
      }
    }
    throw err;
  }
}

/**
 * Distribute a single skill from the canonical directory to all agent-specific
 * directories via symlinks. Universal agents (those sharing .agents/skills)
 * are skipped since the canonical directory IS their skills directory.
 */
export function distributeSkill(
  root: string,
  skillName: string,
  agents: AgentType[],
  customDirs?: string[],
): void {
  const canonicalPath = join(skillsDir(root), skillName);
  if (!existsSync(canonicalPath)) return;

  // Get agent dirs that need symlinks (excludes universal agents)
  const agentDirs = getSymlinkTargets(agents);

  // Merge with custom dirs
  const allDirs = [...agentDirs];
  if (customDirs) {
    for (const dir of customDirs) {
      if (!allDirs.includes(dir)) {
        allDirs.push(dir);
      }
    }
  }

  for (const relDir of allDirs) {
    const linkPath = join(root, relDir, skillName);
    const ok = createRelativeSymlink(canonicalPath, linkPath);
    if (ok) {
      log.info(`  Linked → ${relDir}/${skillName}`);
    }
  }
}

/**
 * Distribute all skills in the canonical directory to agent-specific directories.
 */
export function distributeAllSkills(
  root: string,
  agents: AgentType[],
  customDirs?: string[],
): void {
  const canonical = skillsDir(root);

  if (!existsSync(canonical)) {
    log.warn("No canonical skills directory found (.agents/skills). Nothing to distribute.");
    return;
  }

  const skills = readdirSync(canonical, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (skills.length === 0) {
    log.warn("No skills found in .agents/skills. Nothing to distribute.");
    return;
  }

  const symlinkTargets = getSymlinkTargets(agents);
  const allTargets = [...symlinkTargets, ...(customDirs ?? [])];

  if (allTargets.length === 0) {
    const agentList = agents.length > 0 ? agents.join(", ") : "none detected";
    const allUniversal = agents.length > 0 && agents.every((a) => (UNIVERSAL_AGENTS as readonly string[]).includes(a));
    if (allUniversal) {
      log.info(
        `All detected agents (${agentList}) use the canonical directory directly — no symlinks needed.`,
      );
    } else {
      log.warn(
        `No agent directories to distribute to (agents: ${agentList}). ` +
        `Run with --agent <type> or ensure an agent config file is present.`,
      );
    }
    return;
  }

  for (const name of skills) {
    distributeSkill(root, name, agents, customDirs);
  }
}

/**
 * Remove symlinks for a skill from all agent-specific directories.
 */
export function removeSkillLinks(
  root: string,
  skillName: string,
  agents: AgentType[],
  customDirs?: string[],
): void {
  const agentDirs = getSymlinkTargets(agents);
  const allDirs = [...agentDirs];
  if (customDirs) {
    for (const dir of customDirs) {
      if (!allDirs.includes(dir)) {
        allDirs.push(dir);
      }
    }
  }

  for (const relDir of allDirs) {
    const linkPath = join(root, relDir, skillName);

    try {
      const stat = lstatSync(linkPath);
      if (stat.isSymbolicLink()) {
        unlinkSync(linkPath);
        log.info(`  Unlinked ${relDir}/${skillName}`);
      }
    } catch {
      // ignore — link may already be gone
    }
  }
}
