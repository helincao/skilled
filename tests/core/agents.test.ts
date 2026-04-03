import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  detectAgents,
  resolveAgentTypes,
  AGENT_SYSTEMS,
  CANONICAL_SKILLS_DIR,
  isUniversalAgent,
  getSymlinkTargets,
} from "../../src/core/agents.js";

describe("AGENT_SYSTEMS", () => {
  it("has entries for all agent types", () => {
    const expected = [
      "adal", "amp", "antigravity", "augment", "bob", "claude-code",
      "cline", "codebuddy", "codex", "command-code", "continue", "copilot",
      "cortex", "crush", "cursor", "deepagents", "droid", "firebender",
      "gemini-cli", "goose", "iflow-cli", "junie", "kilo", "kimi-cli",
      "kiro-cli", "kode", "mcpjam", "mistral-vibe", "mux", "neovate",
      "openclaw", "opencode", "openhands", "pi", "pochi", "qoder",
      "qwen-code", "replit", "roo", "trae", "trae-cn", "warp", "windsurf",
      "zencoder",
    ];
    expect(Object.keys(AGENT_SYSTEMS)).toEqual(
      expect.arrayContaining(expected),
    );
  });

  it("each entry has required fields", () => {
    for (const system of Object.values(AGENT_SYSTEMS)) {
      expect(system).toHaveProperty("name");
      expect(system).toHaveProperty("type");
      expect(typeof system.skillsDir).toBe("string");
    }
  });
});

describe("detectAgents", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "skilled-agents-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns empty array when no markers found", () => {
    expect(detectAgents(tmp)).toEqual([]);
  });

  it("detects claude-code by .claude/ directory", () => {
    mkdirSync(join(tmp, ".claude"));
    expect(detectAgents(tmp)).toContain("claude-code");
  });

  it("detects cursor by .cursor/ directory", () => {
    mkdirSync(join(tmp, ".cursor"));
    expect(detectAgents(tmp)).toContain("cursor");
  });

  it("detects cursor by .cursorrules file", () => {
    writeFileSync(join(tmp, ".cursorrules"), "");
    expect(detectAgents(tmp)).toContain("cursor");
  });

  it("detects universal agents via .agents/ directory", () => {
    mkdirSync(join(tmp, ".agents"));
    const result = detectAgents(tmp);
    expect(result).toContain("amp");
    expect(result).toContain("antigravity");
    expect(result).toContain("cline");
    expect(result).toContain("codex");
    expect(result).toContain("copilot");
    expect(result).toContain("cursor");
    expect(result).toContain("deepagents");
    expect(result).toContain("firebender");
    expect(result).toContain("gemini-cli");
    expect(result).toContain("kimi-cli");
    expect(result).toContain("opencode");
    expect(result).toContain("replit");
    expect(result).toContain("warp");
  });

  it("detects windsurf by .windsurf/ directory", () => {
    mkdirSync(join(tmp, ".windsurf"));
    expect(detectAgents(tmp)).toContain("windsurf");
  });

  it("detects windsurf by .windsurfrules file", () => {
    writeFileSync(join(tmp, ".windsurfrules"), "");
    expect(detectAgents(tmp)).toContain("windsurf");
  });

  it("detects continue", () => {
    mkdirSync(join(tmp, ".continue"));
    expect(detectAgents(tmp)).toContain("continue");
  });

  it("detects goose", () => {
    mkdirSync(join(tmp, ".goose"));
    expect(detectAgents(tmp)).toContain("goose");
  });

  it("detects roo", () => {
    mkdirSync(join(tmp, ".roo"));
    expect(detectAgents(tmp)).toContain("roo");
  });

  it("detects kiro", () => {
    mkdirSync(join(tmp, ".kiro"));
    expect(detectAgents(tmp)).toContain("kiro-cli");
  });

  it("detects openhands", () => {
    mkdirSync(join(tmp, ".openhands"));
    expect(detectAgents(tmp)).toContain("openhands");
  });

  it("detects trae and trae-cn", () => {
    mkdirSync(join(tmp, ".trae"));
    const result = detectAgents(tmp);
    expect(result).toContain("trae");
    expect(result).toContain("trae-cn");
  });

  it("detects bob", () => {
    mkdirSync(join(tmp, ".bob"));
    expect(detectAgents(tmp)).toContain("bob");
  });

  it("detects openclaw by .openclaw/ directory", () => {
    mkdirSync(join(tmp, ".openclaw"));
    expect(detectAgents(tmp)).toContain("openclaw");
  });

  it("detects openclaw by .clawdbot/ directory", () => {
    mkdirSync(join(tmp, ".clawdbot"));
    expect(detectAgents(tmp)).toContain("openclaw");
  });

  it("detects openclaw by .moltbot/ directory", () => {
    mkdirSync(join(tmp, ".moltbot"));
    expect(detectAgents(tmp)).toContain("openclaw");
  });

  it("detects codebuddy", () => {
    mkdirSync(join(tmp, ".codebuddy"));
    expect(detectAgents(tmp)).toContain("codebuddy");
  });

  it("detects command-code", () => {
    mkdirSync(join(tmp, ".commandcode"));
    expect(detectAgents(tmp)).toContain("command-code");
  });

  it("detects cortex", () => {
    mkdirSync(join(tmp, ".cortex"));
    expect(detectAgents(tmp)).toContain("cortex");
  });

  it("detects crush", () => {
    mkdirSync(join(tmp, ".crush"));
    expect(detectAgents(tmp)).toContain("crush");
  });

  it("detects droid by .factory/ directory", () => {
    mkdirSync(join(tmp, ".factory"));
    expect(detectAgents(tmp)).toContain("droid");
  });

  it("detects iflow-cli", () => {
    mkdirSync(join(tmp, ".iflow"));
    expect(detectAgents(tmp)).toContain("iflow-cli");
  });

  it("detects junie", () => {
    mkdirSync(join(tmp, ".junie"));
    expect(detectAgents(tmp)).toContain("junie");
  });

  it("detects kode", () => {
    mkdirSync(join(tmp, ".kode"));
    expect(detectAgents(tmp)).toContain("kode");
  });

  it("detects mcpjam", () => {
    mkdirSync(join(tmp, ".mcpjam"));
    expect(detectAgents(tmp)).toContain("mcpjam");
  });

  it("detects mistral-vibe by .vibe/ directory", () => {
    mkdirSync(join(tmp, ".vibe"));
    expect(detectAgents(tmp)).toContain("mistral-vibe");
  });

  it("detects mux", () => {
    mkdirSync(join(tmp, ".mux"));
    expect(detectAgents(tmp)).toContain("mux");
  });

  it("detects neovate", () => {
    mkdirSync(join(tmp, ".neovate"));
    expect(detectAgents(tmp)).toContain("neovate");
  });

  it("detects pi", () => {
    mkdirSync(join(tmp, ".pi"));
    expect(detectAgents(tmp)).toContain("pi");
  });

  it("detects pochi", () => {
    mkdirSync(join(tmp, ".pochi"));
    expect(detectAgents(tmp)).toContain("pochi");
  });

  it("detects qoder", () => {
    mkdirSync(join(tmp, ".qoder"));
    expect(detectAgents(tmp)).toContain("qoder");
  });

  it("detects qwen-code by .qwen/ directory", () => {
    mkdirSync(join(tmp, ".qwen"));
    expect(detectAgents(tmp)).toContain("qwen-code");
  });

  it("detects replit by .replit file when .agents/ absent", () => {
    writeFileSync(join(tmp, ".replit"), "");
    expect(detectAgents(tmp)).toContain("replit");
  });

  it("detects adal", () => {
    mkdirSync(join(tmp, ".adal"));
    expect(detectAgents(tmp)).toContain("adal");
  });

  it("detects multiple agents", () => {
    mkdirSync(join(tmp, ".claude"));
    mkdirSync(join(tmp, ".agents"));
    const result = detectAgents(tmp);
    expect(result).toContain("claude-code");
    expect(result).toContain("cursor");
  });

  it("does not duplicate cursor when both .agents/ and .cursor/ exist", () => {
    mkdirSync(join(tmp, ".agents"));
    mkdirSync(join(tmp, ".cursor"));
    const result = detectAgents(tmp);
    const cursorCount = result.filter((a) => a === "cursor").length;
    expect(cursorCount).toBe(1);
  });

  it("does not duplicate replit when both .agents/ and .replit exist", () => {
    mkdirSync(join(tmp, ".agents"));
    writeFileSync(join(tmp, ".replit"), "");
    const result = detectAgents(tmp);
    const replitCount = result.filter((a) => a === "replit").length;
    expect(replitCount).toBe(1);
  });
});

describe("isUniversalAgent", () => {
  it("returns true for agents using .agents/skills", () => {
    expect(isUniversalAgent("amp")).toBe(true);
    expect(isUniversalAgent("cursor")).toBe(true);
    expect(isUniversalAgent("copilot")).toBe(true);
    expect(isUniversalAgent("warp")).toBe(true);
    expect(isUniversalAgent("antigravity")).toBe(true);
    expect(isUniversalAgent("deepagents")).toBe(true);
    expect(isUniversalAgent("firebender")).toBe(true);
    expect(isUniversalAgent("kimi-cli")).toBe(true);
    expect(isUniversalAgent("opencode")).toBe(true);
    expect(isUniversalAgent("replit")).toBe(true);
  });

  it("returns false for agents with their own directory", () => {
    expect(isUniversalAgent("claude-code")).toBe(false);
    expect(isUniversalAgent("windsurf")).toBe(false);
    expect(isUniversalAgent("goose")).toBe(false);
    expect(isUniversalAgent("bob")).toBe(false);
    expect(isUniversalAgent("openclaw")).toBe(false);
  });
});

describe("getSymlinkTargets", () => {
  it("excludes universal agents", () => {
    const targets = getSymlinkTargets(["amp", "cursor", "copilot"]);
    expect(targets).toEqual([]);
  });

  it("returns unique dirs for non-universal agents", () => {
    const targets = getSymlinkTargets(["claude-code", "windsurf"]);
    expect(targets).toContain(".claude/skills");
    expect(targets).toContain(".windsurf/skills");
    expect(targets).toHaveLength(2);
  });

  it("deduplicates dirs when multiple agents share the same path", () => {
    const targets = getSymlinkTargets(["amp", "cursor", "claude-code"]);
    expect(targets).toEqual([".claude/skills"]);
  });

  it("deduplicates trae and trae-cn (same .trae/skills dir)", () => {
    const targets = getSymlinkTargets(["trae", "trae-cn"]);
    expect(targets).toEqual([".trae/skills"]);
  });

  it("returns mixed results for universal and non-universal agents", () => {
    const targets = getSymlinkTargets(["amp", "claude-code", "windsurf", "copilot"]);
    expect(targets).toEqual([".claude/skills", ".windsurf/skills"]);
  });
});

describe("resolveAgentTypes", () => {
  it("passes through valid agent types", () => {
    expect(resolveAgentTypes(["claude-code", "cursor"])).toEqual([
      "claude-code",
      "cursor",
    ]);
  });

  it("throws on unknown agent type", () => {
    expect(() => resolveAgentTypes(["unknown"])).toThrow('Unknown agent type "unknown"');
  });
});
