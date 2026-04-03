import { existsSync } from "node:fs";
import { join } from "node:path";

/** The canonical skills directory shared by universal agents */
export const CANONICAL_SKILLS_DIR = ".agents/skills";

/** Agent types whose skillsDir matches the canonical directory (no symlink needed) */
export const UNIVERSAL_AGENTS: readonly AgentType[] = [
  "amp", "cline", "codex", "copilot", "cursor", "gemini-cli", "warp",
] as const;

export type AgentType =
  | "amp"
  | "augment"
  | "claude-code"
  | "cline"
  | "codex"
  | "continue"
  | "copilot"
  | "cursor"
  | "gemini-cli"
  | "goose"
  | "kilo"
  | "kiro-cli"
  | "openhands"
  | "roo"
  | "trae"
  | "warp"
  | "windsurf"
  | "zencoder";

export interface AgentSystem {
  name: string;
  type: AgentType;
  /** Directory where this agent discovers skills, relative to project root */
  skillsDir: string;
}

export const AGENT_SYSTEMS: Record<AgentType, AgentSystem> = {
  amp: {
    name: "Amp",
    type: "amp",
    skillsDir: ".agents/skills",
  },
  augment: {
    name: "Augment",
    type: "augment",
    skillsDir: ".augment/skills",
  },
  "claude-code": {
    name: "Claude Code",
    type: "claude-code",
    skillsDir: ".claude/skills",
  },
  cline: {
    name: "Cline",
    type: "cline",
    skillsDir: ".agents/skills",
  },
  codex: {
    name: "Codex",
    type: "codex",
    skillsDir: ".agents/skills",
  },
  continue: {
    name: "Continue",
    type: "continue",
    skillsDir: ".continue/skills",
  },
  copilot: {
    name: "GitHub Copilot",
    type: "copilot",
    skillsDir: ".agents/skills",
  },
  cursor: {
    name: "Cursor",
    type: "cursor",
    skillsDir: ".agents/skills",
  },
  "gemini-cli": {
    name: "Gemini CLI",
    type: "gemini-cli",
    skillsDir: ".agents/skills",
  },
  goose: {
    name: "Goose",
    type: "goose",
    skillsDir: ".goose/skills",
  },
  kilo: {
    name: "Kilo Code",
    type: "kilo",
    skillsDir: ".kilocode/skills",
  },
  "kiro-cli": {
    name: "Kiro",
    type: "kiro-cli",
    skillsDir: ".kiro/skills",
  },
  openhands: {
    name: "OpenHands",
    type: "openhands",
    skillsDir: ".openhands/skills",
  },
  roo: {
    name: "Roo Code",
    type: "roo",
    skillsDir: ".roo/skills",
  },
  trae: {
    name: "Trae",
    type: "trae",
    skillsDir: ".trae/skills",
  },
  warp: {
    name: "Warp",
    type: "warp",
    skillsDir: ".agents/skills",
  },
  windsurf: {
    name: "Windsurf",
    type: "windsurf",
    skillsDir: ".windsurf/skills",
  },
  zencoder: {
    name: "Zencoder",
    type: "zencoder",
    skillsDir: ".zencoder/skills",
  },
};

/** Detect which agent systems are present in the project */
export function detectAgents(root: string): AgentType[] {
  const detected: AgentType[] = [];

  // Agents using the universal .agents/ directory
  if (existsSync(join(root, ".agents"))) {
    detected.push("amp", "cline", "codex", "copilot", "cursor", "gemini-cli", "warp");
  }

  // Claude Code: .claude/ directory
  if (existsSync(join(root, ".claude"))) {
    detected.push("claude-code");
  }

  // Augment: .augment/ directory
  if (existsSync(join(root, ".augment"))) {
    detected.push("augment");
  }

  // Continue: .continue/ directory
  if (existsSync(join(root, ".continue"))) {
    detected.push("continue");
  }

  // Cursor: also detect via .cursor/ or .cursorrules (even without .agents/)
  if (
    !detected.includes("cursor") &&
    (existsSync(join(root, ".cursor")) ||
      existsSync(join(root, ".cursorrules")))
  ) {
    detected.push("cursor");
  }

  // Goose: .goose/ directory
  if (existsSync(join(root, ".goose"))) {
    detected.push("goose");
  }

  // Kilo Code: .kilocode/ directory
  if (existsSync(join(root, ".kilocode"))) {
    detected.push("kilo");
  }

  // Kiro: .kiro/ directory
  if (existsSync(join(root, ".kiro"))) {
    detected.push("kiro-cli");
  }

  // OpenHands: .openhands/ directory
  if (existsSync(join(root, ".openhands"))) {
    detected.push("openhands");
  }

  // Roo Code: .roo/ directory
  if (existsSync(join(root, ".roo"))) {
    detected.push("roo");
  }

  // Trae: .trae/ directory
  if (existsSync(join(root, ".trae"))) {
    detected.push("trae");
  }

  // Windsurf: .windsurf/ directory or .windsurfrules
  if (
    existsSync(join(root, ".windsurf")) ||
    existsSync(join(root, ".windsurfrules"))
  ) {
    detected.push("windsurf");
  }

  // Zencoder: .zencoder/ directory
  if (existsSync(join(root, ".zencoder"))) {
    detected.push("zencoder");
  }

  return detected;
}

export function resolveAgentTypes(agents: string[]): AgentType[] {
  const valid = Object.keys(AGENT_SYSTEMS) as AgentType[];
  for (const a of agents) {
    if (!valid.includes(a as AgentType)) {
      throw new Error(
        `Unknown agent type "${a}". Valid types: ${valid.join(", ")}`,
      );
    }
  }
  return agents as AgentType[];
}

/** Check whether an agent uses the canonical .agents/skills directory directly */
export function isUniversalAgent(agent: AgentType): boolean {
  return AGENT_SYSTEMS[agent].skillsDir === CANONICAL_SKILLS_DIR;
}

/**
 * Get the unique set of agent skill directories that need symlinks.
 * Excludes agents whose skillsDir matches the canonical directory (universal agents).
 * Returns deduplicated relative paths.
 */
export function getSymlinkTargets(agents: AgentType[]): string[] {
  const seen = new Set<string>();
  const targets: string[] = [];
  for (const agent of agents) {
    const dir = AGENT_SYSTEMS[agent].skillsDir;
    if (dir !== CANONICAL_SKILLS_DIR && !seen.has(dir)) {
      seen.add(dir);
      targets.push(dir);
    }
  }
  return targets;
}
