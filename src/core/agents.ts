import { existsSync } from "node:fs";
import { join } from "node:path";

/** The canonical skills directory shared by universal agents */
export const CANONICAL_SKILLS_DIR = ".agents/skills";

/** Agent types whose skillsDir matches the canonical directory (no symlink needed) */
export const UNIVERSAL_AGENTS: readonly AgentType[] = [
  "amp", "antigravity", "cline", "codex", "copilot", "cursor",
  "deepagents", "firebender", "gemini-cli", "kimi-cli", "opencode",
  "replit", "warp",
] as const;

export type AgentType =
  | "adal"
  | "amp"
  | "antigravity"
  | "augment"
  | "bob"
  | "claude-code"
  | "cline"
  | "codebuddy"
  | "codex"
  | "command-code"
  | "continue"
  | "cortex"
  | "copilot"
  | "crush"
  | "cursor"
  | "deepagents"
  | "droid"
  | "firebender"
  | "gemini-cli"
  | "goose"
  | "iflow-cli"
  | "junie"
  | "kilo"
  | "kimi-cli"
  | "kiro-cli"
  | "kode"
  | "mcpjam"
  | "mistral-vibe"
  | "mux"
  | "neovate"
  | "openclaw"
  | "opencode"
  | "openhands"
  | "pi"
  | "pochi"
  | "qoder"
  | "qwen-code"
  | "replit"
  | "roo"
  | "trae"
  | "trae-cn"
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
  adal: {
    name: "AdaL",
    type: "adal",
    skillsDir: ".adal/skills",
  },
  amp: {
    name: "Amp",
    type: "amp",
    skillsDir: ".agents/skills",
  },
  antigravity: {
    name: "Antigravity",
    type: "antigravity",
    skillsDir: ".agents/skills",
  },
  augment: {
    name: "Augment",
    type: "augment",
    skillsDir: ".augment/skills",
  },
  bob: {
    name: "IBM Bob",
    type: "bob",
    skillsDir: ".bob/skills",
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
  codebuddy: {
    name: "CodeBuddy",
    type: "codebuddy",
    skillsDir: ".codebuddy/skills",
  },
  codex: {
    name: "Codex",
    type: "codex",
    skillsDir: ".agents/skills",
  },
  "command-code": {
    name: "Command Code",
    type: "command-code",
    skillsDir: ".commandcode/skills",
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
  cortex: {
    name: "Cortex Code",
    type: "cortex",
    skillsDir: ".cortex/skills",
  },
  crush: {
    name: "Crush",
    type: "crush",
    skillsDir: ".crush/skills",
  },
  cursor: {
    name: "Cursor",
    type: "cursor",
    skillsDir: ".agents/skills",
  },
  deepagents: {
    name: "Deep Agents",
    type: "deepagents",
    skillsDir: ".agents/skills",
  },
  droid: {
    name: "Droid",
    type: "droid",
    skillsDir: ".factory/skills",
  },
  firebender: {
    name: "Firebender",
    type: "firebender",
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
  "iflow-cli": {
    name: "iFlow CLI",
    type: "iflow-cli",
    skillsDir: ".iflow/skills",
  },
  junie: {
    name: "Junie",
    type: "junie",
    skillsDir: ".junie/skills",
  },
  kilo: {
    name: "Kilo Code",
    type: "kilo",
    skillsDir: ".kilocode/skills",
  },
  "kimi-cli": {
    name: "Kimi Code CLI",
    type: "kimi-cli",
    skillsDir: ".agents/skills",
  },
  "kiro-cli": {
    name: "Kiro",
    type: "kiro-cli",
    skillsDir: ".kiro/skills",
  },
  kode: {
    name: "Kode",
    type: "kode",
    skillsDir: ".kode/skills",
  },
  mcpjam: {
    name: "MCPJam",
    type: "mcpjam",
    skillsDir: ".mcpjam/skills",
  },
  "mistral-vibe": {
    name: "Mistral Vibe",
    type: "mistral-vibe",
    skillsDir: ".vibe/skills",
  },
  mux: {
    name: "Mux",
    type: "mux",
    skillsDir: ".mux/skills",
  },
  neovate: {
    name: "Neovate",
    type: "neovate",
    skillsDir: ".neovate/skills",
  },
  openclaw: {
    name: "OpenClaw",
    type: "openclaw",
    skillsDir: "skills",
  },
  opencode: {
    name: "OpenCode",
    type: "opencode",
    skillsDir: ".agents/skills",
  },
  openhands: {
    name: "OpenHands",
    type: "openhands",
    skillsDir: ".openhands/skills",
  },
  pi: {
    name: "Pi",
    type: "pi",
    skillsDir: ".pi/skills",
  },
  pochi: {
    name: "Pochi",
    type: "pochi",
    skillsDir: ".pochi/skills",
  },
  qoder: {
    name: "Qoder",
    type: "qoder",
    skillsDir: ".qoder/skills",
  },
  "qwen-code": {
    name: "Qwen Code",
    type: "qwen-code",
    skillsDir: ".qwen/skills",
  },
  replit: {
    name: "Replit",
    type: "replit",
    skillsDir: ".agents/skills",
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
  "trae-cn": {
    name: "Trae CN",
    type: "trae-cn",
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
    detected.push(
      "amp", "antigravity", "cline", "codex", "copilot", "cursor",
      "deepagents", "firebender", "gemini-cli", "kimi-cli", "opencode",
      "replit", "warp",
    );
  }

  // AdaL: .adal/ directory
  if (existsSync(join(root, ".adal"))) {
    detected.push("adal");
  }

  // Augment: .augment/ directory
  if (existsSync(join(root, ".augment"))) {
    detected.push("augment");
  }

  // IBM Bob: .bob/ directory
  if (existsSync(join(root, ".bob"))) {
    detected.push("bob");
  }

  // Claude Code: .claude/ directory
  if (existsSync(join(root, ".claude"))) {
    detected.push("claude-code");
  }

  // CodeBuddy: .codebuddy/ directory
  if (existsSync(join(root, ".codebuddy"))) {
    detected.push("codebuddy");
  }

  // Command Code: .commandcode/ directory
  if (existsSync(join(root, ".commandcode"))) {
    detected.push("command-code");
  }

  // Continue: .continue/ directory
  if (existsSync(join(root, ".continue"))) {
    detected.push("continue");
  }

  // Cortex Code: .cortex/ directory
  if (existsSync(join(root, ".cortex"))) {
    detected.push("cortex");
  }

  // Crush: .crush/ directory
  if (existsSync(join(root, ".crush"))) {
    detected.push("crush");
  }

  // Cursor: also detect via .cursor/ or .cursorrules (even without .agents/)
  if (
    !detected.includes("cursor") &&
    (existsSync(join(root, ".cursor")) ||
      existsSync(join(root, ".cursorrules")))
  ) {
    detected.push("cursor");
  }

  // Droid: .factory/ directory
  if (existsSync(join(root, ".factory"))) {
    detected.push("droid");
  }

  // Goose: .goose/ directory
  if (existsSync(join(root, ".goose"))) {
    detected.push("goose");
  }

  // iFlow CLI: .iflow/ directory
  if (existsSync(join(root, ".iflow"))) {
    detected.push("iflow-cli");
  }

  // Junie: .junie/ directory
  if (existsSync(join(root, ".junie"))) {
    detected.push("junie");
  }

  // Kilo Code: .kilocode/ directory
  if (existsSync(join(root, ".kilocode"))) {
    detected.push("kilo");
  }

  // Kiro: .kiro/ directory
  if (existsSync(join(root, ".kiro"))) {
    detected.push("kiro-cli");
  }

  // Kode: .kode/ directory
  if (existsSync(join(root, ".kode"))) {
    detected.push("kode");
  }

  // MCPJam: .mcpjam/ directory
  if (existsSync(join(root, ".mcpjam"))) {
    detected.push("mcpjam");
  }

  // Mistral Vibe: .vibe/ directory
  if (existsSync(join(root, ".vibe"))) {
    detected.push("mistral-vibe");
  }

  // Mux: .mux/ directory
  if (existsSync(join(root, ".mux"))) {
    detected.push("mux");
  }

  // Neovate: .neovate/ directory
  if (existsSync(join(root, ".neovate"))) {
    detected.push("neovate");
  }

  // OpenClaw: .openclaw/, .clawdbot/, or .moltbot/ directory
  if (
    existsSync(join(root, ".openclaw")) ||
    existsSync(join(root, ".clawdbot")) ||
    existsSync(join(root, ".moltbot"))
  ) {
    detected.push("openclaw");
  }

  // OpenHands: .openhands/ directory
  if (existsSync(join(root, ".openhands"))) {
    detected.push("openhands");
  }

  // Pi: .pi/ directory
  if (existsSync(join(root, ".pi"))) {
    detected.push("pi");
  }

  // Pochi: .pochi/ directory
  if (existsSync(join(root, ".pochi"))) {
    detected.push("pochi");
  }

  // Qoder: .qoder/ directory
  if (existsSync(join(root, ".qoder"))) {
    detected.push("qoder");
  }

  // Qwen Code: .qwen/ directory
  if (existsSync(join(root, ".qwen"))) {
    detected.push("qwen-code");
  }

  // Replit: also detect via .replit file (even without .agents/)
  if (
    !detected.includes("replit") &&
    existsSync(join(root, ".replit"))
  ) {
    detected.push("replit");
  }

  // Roo Code: .roo/ directory
  if (existsSync(join(root, ".roo"))) {
    detected.push("roo");
  }

  // Trae: .trae/ directory (also covers Trae CN)
  if (existsSync(join(root, ".trae"))) {
    if (!detected.includes("trae")) {
      detected.push("trae");
    }
    detected.push("trae-cn");
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
