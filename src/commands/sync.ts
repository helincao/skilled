import { existsSync, cpSync } from "node:fs";
import { join } from "node:path";
import { readLockfile, setSkillEntry, acquireLock, type SkillEntry } from "../core/manifest.js";
import { resolveRepo, findSkillsRoot, decodeLocalRepo } from "../core/resolver.js";
import { shallowClone } from "../core/git.js";
import { fetchTreeSha } from "../core/github.js";
import { hashDirectory } from "../core/hash.js";
import { skillsDir } from "../utils/config.js";
import { log } from "../utils/logger.js";

import { sanitizeName, isPathSafe } from "../utils/sanitize.js";
import { distributeSkill, getCustomDirs } from "../core/distribute.js";
import { type AgentType, detectAgents, resolveAgentTypes } from "../core/agents.js";

export interface SyncOptions {
  force?: boolean;
  agent?: string[];
  dryRun?: boolean;
}

export async function sync(
  root: string,
  skillName?: string,
  opts: SyncOptions = {},
): Promise<void> {
  const lockfile = readLockfile(root);
  const entries = skillName
    ? [lockfile.skills[skillName]].filter(Boolean)
    : Object.values(lockfile.skills);

  if (entries.length === 0) {
    log.info("No tracked skills to sync.");
    return;
  }

  const agents: AgentType[] = opts.agent
    ? resolveAgentTypes(opts.agent)
    : detectAgents(root);

  const releaseLock = acquireLock(root);

  // Group by repo
  const byRepo = new Map<string, SkillEntry[]>();
  for (const entry of entries) {
    const group = byRepo.get(entry.repo) ?? [];
    group.push(entry);
    byRepo.set(entry.repo, group);
  }

  try {
    for (const [repo, repoEntries] of byRepo) {
      const localRepoPath = decodeLocalRepo(repo);

      if (localRepoPath) {
        // Local path install — re-read from the original directory
        log.step(`Syncing from local path ${localRepoPath}...`);

        if (!existsSync(localRepoPath)) {
          log.warn(`Local path no longer exists: ${localRepoPath}`);
          continue;
        }

        const remoteSkills = findSkillsRoot(localRepoPath);

        for (const entry of repoEntries) {
          const safeName = sanitizeName(entry.name);
          const localSkills = skillsDir(root);
          if (!isPathSafe(localSkills, safeName)) {
            log.warn(`Skipping "${entry.name}" — unsafe path detected.`);
            continue;
          }

          const localDir = join(localSkills, safeName);
          const remoteDir = join(remoteSkills, entry.name);

          if (!existsSync(remoteDir)) {
            log.warn(`Skill "${entry.name}" no longer exists in ${localRepoPath}`);
            continue;
          }

          if (existsSync(localDir)) {
            const currentHash = hashDirectory(localDir);
            if (currentHash !== entry.installedHash && !opts.force) {
              log.warn(
                `Skill "${entry.name}" has local modifications. Use --force to overwrite, or upstream first.`,
              );
              continue;
            }
          }

          if (opts.dryRun) {
            log.info(`  [dry-run] Would sync ${entry.name} from ${localRepoPath}`);
            continue;
          }

          cpSync(remoteDir, localDir, { recursive: true });
          const contentHash = hashDirectory(localDir);

          setSkillEntry(root, {
            ...entry,
            syncedAt: new Date().toISOString(),
            installedHash: contentHash,
          });

          distributeSkill(root, entry.name, agents, getCustomDirs(root));
          log.success(`Synced ${entry.name} (local)`);
        }

        continue;
      }

      const resolved = resolveRepo(repo);
      log.step(`Fetching latest from ${resolved.slug}...`);

      const clone = await shallowClone(resolved.cloneUrl);

      try {
        const remoteSkills = findSkillsRoot(clone.dir);

        for (const entry of repoEntries) {
          const safeName = sanitizeName(entry.name);
          const localSkills = skillsDir(root);
          if (!isPathSafe(localSkills, safeName)) {
            log.warn(`Skipping "${entry.name}" — unsafe path detected.`);
            continue;
          }

          const localDir = join(localSkills, safeName);
          const remoteDir = join(remoteSkills, entry.name);

          if (!existsSync(remoteDir)) {
            log.warn(`Skill "${entry.name}" no longer exists in ${repo}`);
            continue;
          }

          // Check for local modifications
          if (existsSync(localDir)) {
            const currentHash = hashDirectory(localDir);
            if (currentHash !== entry.installedHash && !opts.force) {
              log.warn(
                `Skill "${entry.name}" has local modifications. Use --force to overwrite, or upstream first.`,
              );
              continue;
            }
          }

          if (opts.dryRun) {
            log.info(`  [dry-run] Would sync ${entry.name} → ${clone.headSha.slice(0, 7)}`);
            continue;
          }

          // Copy remote → local
          cpSync(remoteDir, localDir, { recursive: true });

          const contentHash = hashDirectory(localDir);

          // Fetch updated tree SHA
          const treeSha = await fetchTreeSha(
            resolved.owner,
            resolved.repo,
            entry.remotePath,
          );

          setSkillEntry(root, {
            ...entry,
            commitSha: clone.headSha,
            syncedAt: new Date().toISOString(),
            installedHash: contentHash,
            treeSha: treeSha ?? entry.treeSha,
          });

          // Re-distribute symlinks after sync
          distributeSkill(root, entry.name, agents, getCustomDirs(root));

          log.success(
            `Synced ${entry.name} → ${clone.headSha.slice(0, 7)}`,
          );
        }
      } finally {
        clone.cleanup();
      }
    }

  } finally {
    releaseLock();
  }
}
