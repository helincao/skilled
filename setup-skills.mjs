#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, lstatSync, readlinkSync, rmSync, symlinkSync } from "fs";
import { dirname, join, relative, resolve } from "path";
import { fileURLToPath } from "url";

function parseArgs(argv) {
  const args = { projectRoot: process.cwd(), help: false };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    if (token === "--project-root") {
      const value = argv[++i];
      if (!value || value.startsWith("-")) {
        console.error("Error: --project-root requires a path");
        printUsage();
        process.exit(1);
      }
      args.projectRoot = value;
      continue;
    }
    console.error(`Error: Unknown option "${token}"`);
    printUsage();
    process.exit(1);
  }
  return args;
}

function printUsage() {
  console.log(`
skilled-setup-skills

Usage:
  skilled-setup-skills [--project-root <path>]

Options:
  --project-root <path>    Project root where agent skills directories should be updated
  -h, --help               Show this help
`);
}

function ensureDir(pathname) {
  if (!existsSync(pathname)) {
    mkdirSync(pathname, { recursive: true });
  }
}

function isSameTarget(linkPath, expectedTarget) {
  try {
    const currentRaw = readlinkSync(linkPath);
    const currentAbs = resolve(dirname(linkPath), currentRaw);
    const expectedAbs = resolve(expectedTarget);
    return currentAbs === expectedAbs;
  } catch {
    return false;
  }
}

function syncAgentSkills({ projectRoot, coreSkillsDir, agentDirName }) {
  const agentDir = join(projectRoot, agentDirName);
  const agentSkillsDir = join(agentDir, "skills");
  ensureDir(agentSkillsDir);

  const skillDirs = readdirSync(coreSkillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const stats = { linked: 0, updated: 0, skippedEjected: 0, skippedOther: 0 };

  for (const skill of skillDirs) {
    const target = join(coreSkillsDir, skill);
    const linkPath = join(agentSkillsDir, skill);

    if (!existsSync(linkPath)) {
      const relTarget = relative(dirname(linkPath), target);
      symlinkSync(relTarget, linkPath, "dir");
      stats.linked += 1;
      continue;
    }

    const current = lstatSync(linkPath);
    if (current.isDirectory() && !current.isSymbolicLink()) {
      stats.skippedEjected += 1;
      continue;
    }

    if (current.isSymbolicLink()) {
      if (isSameTarget(linkPath, target)) {
        continue;
      }
      rmSync(linkPath, { recursive: true, force: true });
      const relTarget = relative(dirname(linkPath), target);
      symlinkSync(relTarget, linkPath, "dir");
      stats.updated += 1;
      continue;
    }

    stats.skippedOther += 1;
  }

  return { agentSkillsDir, stats };
}

function main() {
  const { projectRoot, help } = parseArgs(process.argv.slice(2));
  if (help) {
    printUsage();
    process.exit(0);
  }

  const packageRoot = dirname(fileURLToPath(import.meta.url));
  const coreSkillsDir = join(packageRoot, "skills");

  if (!existsSync(coreSkillsDir)) {
    console.error(`Error: core skills directory not found: ${coreSkillsDir}`);
    process.exit(1);
  }

  const resolvedProjectRoot = resolve(projectRoot);
  const agentDirNames = [".claude", ".codex"];

  for (const agentDirName of agentDirNames) {
    const { agentSkillsDir, stats } = syncAgentSkills({
      projectRoot: resolvedProjectRoot,
      coreSkillsDir,
      agentDirName,
    });

    console.log(`Synced core skills into ${agentSkillsDir}`);
    console.log(`  Linked: ${stats.linked}`);
    console.log(`  Updated: ${stats.updated}`);
    console.log(`  Skipped ejected: ${stats.skippedEjected}`);
    if (stats.skippedOther > 0) {
      console.log(`  Skipped non-directory entries: ${stats.skippedOther}`);
    }
  }
}

main();
