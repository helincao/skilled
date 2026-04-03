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
      "amp", "augment", "claude-code", "cline", "codex", "continue",
      "copilot", "cursor", "gemini-cli", "goose", "kilo", "kiro-cli",
      "openhands", "roo", "trae", "warp", "windsurf", "zencoder",
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
    expect(result).toContain("cline");
    expect(result).toContain("codex");
    expect(result).toContain("copilot");
    expect(result).toContain("cursor");
    expect(result).toContain("gemini-cli");
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

  it("detects trae", () => {
    mkdirSync(join(tmp, ".trae"));
    expect(detectAgents(tmp)).toContain("trae");
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
});

describe("isUniversalAgent", () => {
  it("returns true for agents using .agents/skills", () => {
    expect(isUniversalAgent("amp")).toBe(true);
    expect(isUniversalAgent("cursor")).toBe(true);
    expect(isUniversalAgent("copilot")).toBe(true);
    expect(isUniversalAgent("warp")).toBe(true);
  });

  it("returns false for agents with their own directory", () => {
    expect(isUniversalAgent("claude-code")).toBe(false);
    expect(isUniversalAgent("windsurf")).toBe(false);
    expect(isUniversalAgent("goose")).toBe(false);
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
