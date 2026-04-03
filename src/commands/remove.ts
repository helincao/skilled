import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { readLockfile, removeSkillEntry, acquireLock } from "../core/manifest.js";
import { skillsDir } from "../utils/config.js";
import { log } from "../utils/logger.js";
import { removeSkillLinks, getCustomDirs } from "../core/distribute.js";
import { type AgentType, detectAgents, resolveAgentTypes } from "../core/agents.js";

export interface RemoveOptions {
  force?: boolean;
  json?: boolean;
  agent?: string[];
}

export async function remove(
  root: string,
  skillName: string,
  opts: RemoveOptions = {},
): Promise<void> {
  const lockfile = readLockfile(root);
  const entry = lockfile.skills[skillName];

  if (!entry) {
    throw new Error(
      `Skill "${skillName}" is not tracked. Run \`skilled list\` to see installed skills.`,
    );
  }

  const agents: AgentType[] = opts.agent
    ? resolveAgentTypes(opts.agent)
    : (entry.agents as AgentType[]) ?? detectAgents(root);

  const releaseLock = acquireLock(root);

  try {
    // Remove symlinks from agent-specific directories first
    removeSkillLinks(root, skillName, agents, getCustomDirs(root));

    // Delete the canonical skill directory
    const localDir = join(skillsDir(root), skillName);
    if (existsSync(localDir)) {
      rmSync(localDir, { recursive: true, force: true });
    }

    // Remove from lockfile
    removeSkillEntry(root, skillName);

    if (opts.json) {
      console.log(JSON.stringify({ removed: skillName }));
    } else {
      log.success(`Removed ${skillName}`);
    }
  } finally {
    releaseLock();
  }
}
