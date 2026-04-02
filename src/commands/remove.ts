import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { readLockfile, removeSkillEntry, acquireLock } from "../core/manifest.js";
import { skillsDir } from "../utils/config.js";
import { log } from "../utils/logger.js";
import { type AgentType, detectAgents, resolveAgentTypes } from "../core/agents.js";
import { updateAgentInstructions } from "../core/instructions.js";

export interface RemoveOptions {
  force?: boolean;
  json?: boolean;
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

  const releaseLock = acquireLock(root);

  try {
    const localDir = join(skillsDir(root), skillName);

    // Delete the skill directory
    if (existsSync(localDir)) {
      rmSync(localDir, { recursive: true, force: true });
    }

    // Remove from lockfile
    removeSkillEntry(root, skillName);

    // Regenerate agent instruction files
    const agents: AgentType[] = entry.agents
      ? resolveAgentTypes(entry.agents)
      : detectAgents(root);

    if (agents.length > 0) {
      updateAgentInstructions(root, agents);
    }

    if (opts.json) {
      console.log(JSON.stringify({ removed: skillName }));
    } else {
      log.success(`Removed ${skillName}`);
    }
  } finally {
    releaseLock();
  }
}
