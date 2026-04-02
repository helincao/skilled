import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { type AgentType, AGENT_SYSTEMS } from "./agents.js";
import { parseSkillMeta, type SkillMeta } from "./skill-parser.js";
import { skillsDir } from "../utils/config.js";
import { log } from "../utils/logger.js";

const MANAGED_START = "<!-- skilled:managed-start -->";
const MANAGED_END = "<!-- skilled:managed-end -->";

/** Collect metadata for all installed skills */
function collectSkillsMeta(root: string): SkillMeta[] {
  const dir = skillsDir(root);
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => parseSkillMeta(join(dir, d.name)))
    .filter((m): m is SkillMeta => m !== null);
}

/** Generate the managed block content for a given agent type */
function generateBlock(agent: AgentType, skills: SkillMeta[]): string {
  if (skills.length === 0) return "";

  const lines: string[] = [MANAGED_START];

  switch (agent) {
    case "claude-code":
      lines.push("");
      lines.push("## Skills");
      lines.push("");
      lines.push(
        "The following skills are available in the `skills/` directory:",
      );
      lines.push("");
      for (const s of skills) {
        lines.push(`- **${s.name}** — ${s.description}`);
      }
      lines.push("");
      lines.push(
        "Read the skill's `SKILL.md` for full instructions before using it.",
      );
      break;

    case "cursor":
      lines.push("---");
      lines.push("description: Available skills installed by skilled");
      lines.push("globs: *");
      lines.push("alwaysApply: true");
      lines.push("---");
      lines.push("");
      lines.push("# Available Skills");
      lines.push("");
      for (const s of skills) {
        lines.push(`- **${s.name}** — ${s.description}`);
      }
      lines.push("");
      lines.push(
        "Read the skill's `SKILL.md` in `skills/` for full instructions before using it.",
      );
      break;

    case "copilot":
      lines.push("");
      lines.push("## Skills");
      lines.push("");
      lines.push(
        "The following skills are available in the `skills/` directory:",
      );
      lines.push("");
      for (const s of skills) {
        lines.push(`- **${s.name}** — ${s.description}`);
      }
      lines.push("");
      lines.push(
        "Read the skill's `SKILL.md` for full instructions before using it.",
      );
      break;

    case "windsurf":
      lines.push("");
      lines.push("## Skills");
      lines.push("");
      lines.push(
        "The following skills are available in the `skills/` directory:",
      );
      lines.push("");
      for (const s of skills) {
        lines.push(`- **${s.name}** — ${s.description}`);
      }
      lines.push("");
      lines.push(
        "Read the skill's `SKILL.md` for full instructions before using it.",
      );
      break;

    case "codex":
      lines.push("");
      lines.push("## Skills");
      lines.push("");
      lines.push(
        "The following skills are available in the `skills/` directory:",
      );
      lines.push("");
      for (const s of skills) {
        lines.push(`- **${s.name}** — ${s.description}`);
      }
      lines.push("");
      lines.push(
        "Read the skill's `SKILL.md` for full instructions before using it.",
      );
      break;
  }

  lines.push(MANAGED_END);
  return lines.join("\n");
}

/** Insert or replace the managed block in an existing file */
function upsertManagedBlock(filePath: string, block: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (!existsSync(filePath)) {
    writeFileSync(filePath, block + "\n");
    return;
  }

  const content = readFileSync(filePath, "utf-8");
  const startIdx = content.indexOf(MANAGED_START);
  const endIdx = content.indexOf(MANAGED_END);

  if (startIdx !== -1 && endIdx !== -1) {
    // Replace existing managed block
    const before = content.slice(0, startIdx);
    const after = content.slice(endIdx + MANAGED_END.length);
    writeFileSync(filePath, before + block + after);
  } else {
    // Append managed block
    const separator = content.endsWith("\n") ? "\n" : "\n\n";
    writeFileSync(filePath, content + separator + block + "\n");
  }
}

/**
 * Generate/update instruction files for the specified agent systems.
 * Reads all installed skills and writes a managed block into each agent's
 * instruction file.
 */
export function updateAgentInstructions(
  root: string,
  agents: AgentType[],
): void {
  const skills = collectSkillsMeta(root);

  for (const agentType of agents) {
    const system = AGENT_SYSTEMS[agentType];
    const filePath = join(root, system.instructionPath);
    const block = generateBlock(agentType, skills);

    if (skills.length === 0 && !existsSync(filePath)) {
      // Nothing to write and no file to update
      continue;
    }

    upsertManagedBlock(filePath, block);
    log.success(`Updated ${system.instructionPath} for ${system.name}`);
  }
}
