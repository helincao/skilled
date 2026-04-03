import { Command } from "commander";
import { findProjectRoot } from "../src/utils/config.js";
import { version } from "../package.json";
import { install } from "../src/commands/install.js";
import { list } from "../src/commands/list.js";
import { check } from "../src/commands/check.js";
import { sync } from "../src/commands/sync.js";
import { upstream } from "../src/commands/upstream.js";
import { search } from "../src/commands/search.js";
import { remove } from "../src/commands/remove.js";
import { installHook } from "../src/hooks/pre-push.js";
import { log } from "../src/utils/logger.js";
import { distributeAllSkills, getCustomDirs } from "../src/core/distribute.js";
import { readLockfile, writeLockfile } from "../src/core/manifest.js";
import { detectAgents, resolveAgentTypes } from "../src/core/agents.js";

const program = new Command();

program
  .name("skilled")
  .description("AI Agent Skill Lifecycle Management Tool")
  .version(version);

// ── install ──────────────────────────────────────────────
program
  .command("install [repo]")
  .description(
    "Install skills from a remote GitHub repository, or restore all skills from the lockfile when no repo is given",
  )
  .option("-s, --skill <name>", "Install a specific skill only")
  .option("-f, --force", "Overwrite existing local skills")
  .option(
    "-a, --agent <types...>",
    "Target agent systems (claude-code, cursor, copilot, windsurf, codex). Auto-detects if omitted.",
  )
  .action(async (repo: string | undefined, opts) => {
    try {
      const root = findProjectRoot();
      if (repo) {
        await install(repo, root, opts);
      } else {
        const { installFromLockfile } = await import(
          "../src/commands/install.js"
        );
        await installFromLockfile(root, opts);
      }
    } catch (err: unknown) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

// ── list ─────────────────────────────────────────────────
program
  .command("list")
  .alias("ls")
  .description("List installed skills and their status")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    try {
      const root = findProjectRoot();
      await list(root, opts);
    } catch (err: unknown) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

// ── check ────────────────────────────────────────────────
program
  .command("check [skill]")
  .description("Check for drift between local and remote skills")
  .option("--json", "Output as JSON")
  .action(async (skillName: string | undefined, opts) => {
    try {
      const root = findProjectRoot();
      const results = await check(root, skillName, opts);
      const conflicts = results.filter((r) => r.conflict);
      if (conflicts.length > 0 && !opts.json) {
        process.exit(1);
      }
    } catch (err: unknown) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

// ── remove ──────────────────────────────────────────────
program
  .command("remove <skill>")
  .alias("rm")
  .description("Remove an installed skill")
  .option("--json", "Output as JSON")
  .action(async (skillName: string, opts) => {
    try {
      const root = findProjectRoot();
      await remove(root, skillName, opts);
    } catch (err: unknown) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

// ── search ──────────────────────────────────────────────
program
  .command("search <repo> [query]")
  .description("Browse available skills in a remote repository")
  .option("--json", "Output as JSON")
  .action(async (repo: string, query: string | undefined, opts) => {
    try {
      await search(repo, query, opts);
    } catch (err: unknown) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

// ── sync ─────────────────────────────────────────────────
program
  .command("sync [skill]")
  .description("Pull latest skill versions from remote")
  .option("-f, --force", "Overwrite local modifications")
  .option(
    "-a, --agent <types...>",
    "Target agent systems. Auto-detects if omitted.",
  )
  .action(async (skillName: string | undefined, opts) => {
    try {
      const root = findProjectRoot();
      await sync(root, skillName, opts);
    } catch (err: unknown) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

// ── upstream ─────────────────────────────────────────────
program
  .command("upstream <skill>")
  .description("Create a PR to upstream local skill changes to the source repo")
  .action(async (skillName: string) => {
    try {
      const root = findProjectRoot();
      await upstream(root, skillName);
    } catch (err: unknown) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

// ── hooks ────────────────────────────────────────────────
const hooks = program
  .command("hooks")
  .description("Manage git hooks");

hooks
  .command("install")
  .description("Install the pre-push hook for automatic upstream reminders")
  .action(async () => {
    try {
      const root = findProjectRoot();
      installHook(root);
    } catch (err: unknown) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

// ── config ──────────────────────────────────────────────
const config = program
  .command("config")
  .description("Manage skilled configuration");

config
  .command("add-dir <path>")
  .description("Add a custom skills directory (relative to project root)")
  .action(async (dirPath: string) => {
    try {
      const root = findProjectRoot();
      const lockfile = readLockfile(root);
      lockfile.customDirs = lockfile.customDirs ?? [];
      if (!lockfile.customDirs.includes(dirPath)) {
        lockfile.customDirs.push(dirPath);
      }
      writeLockfile(root, lockfile);
      log.success(`Added custom directory: ${dirPath}`);
    } catch (err: unknown) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

config
  .command("remove-dir <path>")
  .description("Remove a custom skills directory")
  .action(async (dirPath: string) => {
    try {
      const root = findProjectRoot();
      const lockfile = readLockfile(root);
      lockfile.customDirs = (lockfile.customDirs ?? []).filter((d) => d !== dirPath);
      if (lockfile.customDirs.length === 0) delete lockfile.customDirs;
      writeLockfile(root, lockfile);
      log.success(`Removed custom directory: ${dirPath}`);
    } catch (err: unknown) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

config
  .command("show")
  .description("Show current configuration")
  .action(async () => {
    try {
      const root = findProjectRoot();
      const lockfile = readLockfile(root);
      const agents = detectAgents(root);
      console.log(JSON.stringify({
        agents,
        customDirs: lockfile.customDirs ?? [],
      }, null, 2));
    } catch (err: unknown) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

// ── distribute ──────────────────────────────────────────
program
  .command("distribute")
  .description("Re-create symlinks from canonical to all agent directories")
  .option(
    "-a, --agent <types...>",
    "Target agent systems. Auto-detects if omitted.",
  )
  .action(async (opts) => {
    try {
      const root = findProjectRoot();
      const agents = opts.agent
        ? resolveAgentTypes(opts.agent)
        : detectAgents(root);
      distributeAllSkills(root, agents, getCustomDirs(root));
      log.success("Symlinks distributed.");
    } catch (err: unknown) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

program.parse();
