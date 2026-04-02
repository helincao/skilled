import { existsSync } from "node:fs";
import { join } from "node:path";

export type AgentType =
  | "claude-code"
  | "cursor"
  | "copilot"
  | "windsurf"
  | "codex";

export interface AgentSystem {
  name: string;
  type: AgentType;
  /** Path to the instruction file relative to project root */
  instructionPath: string;
  /** Whether the file is append-friendly (vs. must be regenerated) */
  appendable: boolean;
}

export const AGENT_SYSTEMS: Record<AgentType, AgentSystem> = {
  "claude-code": {
    name: "Claude Code",
    type: "claude-code",
    instructionPath: "CLAUDE.md",
    appendable: true,
  },
  cursor: {
    name: "Cursor",
    type: "cursor",
    instructionPath: ".cursor/rules/skills.mdc",
    appendable: false,
  },
  copilot: {
    name: "GitHub Copilot",
    type: "copilot",
    instructionPath: ".github/copilot-instructions.md",
    appendable: true,
  },
  windsurf: {
    name: "Windsurf",
    type: "windsurf",
    instructionPath: ".windsurfrules",
    appendable: true,
  },
  codex: {
    name: "Codex",
    type: "codex",
    instructionPath: "AGENTS.md",
    appendable: true,
  },
};

/** Detect which agent systems are present in the project */
export function detectAgents(root: string): AgentType[] {
  const detected: AgentType[] = [];

  // Claude Code: CLAUDE.md or .claude/ directory
  if (
    existsSync(join(root, "CLAUDE.md")) ||
    existsSync(join(root, ".claude"))
  ) {
    detected.push("claude-code");
  }

  // Cursor: .cursor/ directory or .cursorrules
  if (
    existsSync(join(root, ".cursor")) ||
    existsSync(join(root, ".cursorrules"))
  ) {
    detected.push("cursor");
  }

  // Copilot: .github/copilot-instructions.md
  if (existsSync(join(root, ".github", "copilot-instructions.md"))) {
    detected.push("copilot");
  }

  // Windsurf: .windsurfrules
  if (existsSync(join(root, ".windsurfrules"))) {
    detected.push("windsurf");
  }

  // Codex: AGENTS.md
  if (existsSync(join(root, "AGENTS.md"))) {
    detected.push("codex");
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
