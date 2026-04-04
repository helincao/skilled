import { existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { readLockfile, type SkillEntry } from "../core/manifest.js";
import { fetchTreeSha, type FetchTreeResult } from "../core/github.js";
import { resolveRepo, decodeLocalRepo } from "../core/resolver.js";
import { shallowClone, diffDirs } from "../core/git.js";
import { hashDirectory } from "../core/hash.js";
import { skillsDir } from "../utils/config.js";
import { log } from "../utils/logger.js";

export interface CheckResult {
  name: string;
  localModified: boolean;
  remoteModified: boolean;
  conflict: boolean;
  detail: string;
}

export interface CheckOptions {
  json?: boolean;
}

export async function check(
  root: string,
  skillName?: string,
  opts: CheckOptions = {},
): Promise<CheckResult[]> {
  const lockfile = readLockfile(root);
  const entries = skillName
    ? [lockfile.skills[skillName]].filter(Boolean)
    : Object.values(lockfile.skills);

  if (entries.length === 0) {
    if (opts.json) {
      console.log(JSON.stringify([]));
    } else {
      log.info("No tracked skills to check.");
    }
    return [];
  }

  // Group entries by repo to minimize API calls
  const byRepo = new Map<string, SkillEntry[]>();
  for (const entry of entries) {
    const group = byRepo.get(entry.repo) ?? [];
    group.push(entry);
    byRepo.set(entry.repo, group);
  }

  const results: CheckResult[] = [];

  for (const [repo, repoEntries] of byRepo) {
    // Local-path installs have no remote to check — only report local changes
    if (decodeLocalRepo(repo) !== null) {
      for (const entry of repoEntries) {
        const localDir = join(skillsDir(root), entry.name);
        if (!existsSync(localDir)) {
          results.push({ name: entry.name, localModified: false, remoteModified: false, conflict: false, detail: "Local skill directory missing" });
          continue;
        }
        const currentHash = hashDirectory(localDir);
        const localModified = currentHash !== entry.installedHash;
        results.push({ name: entry.name, localModified, remoteModified: false, conflict: false, detail: localModified ? "Local changes (installed from local path)" : "Up to date (local path install)" });
      }
      continue;
    }

    const resolved = resolveRepo(repo);
    log.step(`Checking ${resolved.slug}...`);

    // Try fast Tree SHA check first, fall back to clone-based check
    const canUseFastCheck = repoEntries.every((e) => e.treeSha);

    if (canUseFastCheck) {
      for (const entry of repoEntries) {
        const localDir = join(skillsDir(root), entry.name);

        if (!existsSync(localDir)) {
          results.push({
            name: entry.name,
            localModified: false,
            remoteModified: false,
            conflict: false,
            detail: "Local skill directory missing",
          });
          continue;
        }

        // Check local modifications (hash-based, no network)
        const currentHash = hashDirectory(localDir);
        const localModified = currentHash !== entry.installedHash;

        // Check remote modifications via Tree SHA API
        let remoteModified = false;
        const remoteResult: FetchTreeResult = await fetchTreeSha(
          resolved.owner,
          resolved.repo,
          entry.remotePath,
          true,
        );

        if (remoteResult.status === "ok") {
          remoteModified = remoteResult.sha !== entry.treeSha;
        } else if (remoteResult.status === "rate_limited") {
          log.warn(`Could not check remote for ${entry.name} (rate limited, resets ${remoteResult.resetsAt ?? "soon"})`);
        } else if (remoteResult.status === "network_error") {
          log.warn(`Could not check remote for ${entry.name} (network error: ${remoteResult.message})`);
        } else {
          log.warn(`Skill path "${entry.remotePath}" not found on remote for ${entry.name}`);
        }

        const conflict = localModified && remoteModified;

        let detail: string;
        if (conflict) {
          detail = "CONFLICT — both local and remote have changes";
        } else if (localModified) {
          detail = "Local changes (not yet upstreamed)";
        } else if (remoteModified) {
          detail = "Remote has updates (run `skilled sync`)";
        } else {
          detail = "Up to date";
        }

        results.push({
          name: entry.name,
          localModified,
          remoteModified,
          conflict,
          detail,
        });
      }
    } else {
      // Fallback: clone-based check for skills without treeSha
      log.dim("(no tree SHA cached — using clone-based check)");
      const clone = await shallowClone(resolved.cloneUrl);

      try {
        for (const entry of repoEntries) {
          const localDir = join(skillsDir(root), entry.name);
          const remoteDir = join(clone.dir, entry.remotePath);

          if (!existsSync(localDir)) {
            results.push({
              name: entry.name,
              localModified: false,
              remoteModified: false,
              conflict: false,
              detail: "Local skill directory missing",
            });
            continue;
          }

          const currentHash = hashDirectory(localDir);
          const localModified = currentHash !== entry.installedHash;

          const remoteChanged = clone.headSha !== entry.commitSha;
          let remoteModified = false;

          if (remoteChanged && existsSync(remoteDir)) {
            const diff = await diffDirs(localDir, remoteDir);
            remoteModified = diff.trim().length > 0;
          }

          const conflict = localModified && remoteModified;

          let detail: string;
          if (conflict) {
            detail = "CONFLICT — both local and remote have changes";
          } else if (localModified) {
            detail = "Local changes (not yet upstreamed)";
          } else if (remoteModified) {
            detail = "Remote has updates (run `skilled sync`)";
          } else {
            detail = "Up to date";
          }

          results.push({
            name: entry.name,
            localModified,
            remoteModified,
            conflict,
            detail,
          });
        }
      } finally {
        clone.cleanup();
      }
    }
  }

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    // Print results
    console.log();
    console.log(chalk.bold("Skill status:"));
    console.log();
    for (const r of results) {
      const icon = r.conflict
        ? chalk.red("⚡")
        : r.remoteModified
          ? chalk.yellow("↓")
          : r.localModified
            ? chalk.blue("↑")
            : chalk.green("✓");
      console.log(`  ${icon} ${chalk.cyan(r.name.padEnd(24))} ${r.detail}`);
    }
    console.log();
  }

  return results;
}
