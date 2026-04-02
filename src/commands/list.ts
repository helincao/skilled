import { existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { readLockfile } from "../core/manifest.js";
import { hashDirectory } from "../core/hash.js";
import { skillsDir } from "../utils/config.js";
import { log } from "../utils/logger.js";

export interface ListOptions {
  json?: boolean;
}

interface ListEntry {
  name: string;
  status: "clean" | "modified" | "missing";
  repo: string;
  commitSha: string;
  syncedAt: string;
  agents?: string[];
}

export async function list(root: string, opts: ListOptions = {}): Promise<void> {
  const lockfile = readLockfile(root);
  const entries = Object.values(lockfile.skills);

  if (entries.length === 0) {
    if (opts.json) {
      console.log(JSON.stringify([]));
    } else {
      log.info("No tracked skills. Use `skilled install <repo>` to add skills.");
    }
    return;
  }

  const results: ListEntry[] = [];

  for (const entry of entries) {
    const localDir = join(skillsDir(root), entry.name);
    const exists = existsSync(localDir);

    let status: ListEntry["status"];
    if (!exists) {
      status = "missing";
    } else {
      const currentHash = hashDirectory(localDir);
      status = currentHash === entry.installedHash ? "clean" : "modified";
    }

    results.push({
      name: entry.name,
      status,
      repo: entry.repo,
      commitSha: entry.commitSha,
      syncedAt: entry.syncedAt,
      agents: entry.agents,
    });
  }

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log();
  console.log(chalk.bold("Installed skills:"));
  console.log();

  for (const r of results) {
    const statusStr =
      r.status === "missing"
        ? chalk.red("MISSING")
        : r.status === "modified"
          ? chalk.yellow("modified")
          : chalk.green("clean");

    console.log(
      `  ${chalk.cyan(r.name.padEnd(24))} ${statusStr.padEnd(20)} ${chalk.dim(r.repo)} ${chalk.dim(`@${r.commitSha.slice(0, 7)}`)}`,
    );
  }

  console.log();
}
