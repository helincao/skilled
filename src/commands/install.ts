import { existsSync, cpSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
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
import { updateAgentInstructions } from "../core/instructions.js";
import { sanitizeName, isPathSafe } from "../utils/sanitize.js";
import type { ResolvedRepo } from "../core/resolver.js";

export interface InstallOptions {
  skill?: string;
  force?: boolean;
  agent?: string[];
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
  const remoteSkillsDir = findSkillsRoot(clone.dir);

  if (!existsSync(remoteSkillsDir)) {
    throw new Error(
      `No skills/ directory found in ${resolved.slug}. Expected skills at: ${remoteSkillsDir}`,
    );
  }

  const available = readdirSync(remoteSkillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

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

    const src = join(remoteSkillsDir, name);
    const dest = join(localSkillsPath, safeName);

    if (existsSync(dest) && !opts.force) {
      log.warn(
        `Skill "${safeName}" already exists locally. Use --force to overwrite.`,
      );
      continue;
    }

    cpSync(src, dest, { recursive: true });

    const contentHash = hashDirectory(dest);
    const remotePath = `skills/${name}`;

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
      const remoteSkillsDir = findSkillsRoot(clone.dir);
      const available = existsSync(remoteSkillsDir)
        ? readdirSync(remoteSkillsDir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name)
        : [];
      if (!available.includes(opts.skill)) {
        throw new Error(
          `Skill "${opts.skill}" not found in ${resolved.slug}. Available: ${available.join(", ")}`,
        );
      }
    }

    await installFromClone(resolved, clone, root, skillNames, agents, opts);

    if (agents.length > 0) {
      updateAgentInstructions(root, agents);
    }
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
        const skillNames = skills.map((s) =>
          s.remotePath.replace(/^skills\//, ""),
        );
        await installFromClone(resolved, clone, root, skillNames, agents, opts);
      } finally {
        clone.cleanup();
      }
    }

    if (agents.length > 0) {
      updateAgentInstructions(root, agents);
    }
  } finally {
    releaseLock();
  }
}
