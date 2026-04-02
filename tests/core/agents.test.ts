import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  detectAgents,
  resolveAgentTypes,
  AGENT_SYSTEMS,
} from "../../src/core/agents.js";

describe("AGENT_SYSTEMS", () => {
  it("has entries for all five agent types", () => {
    expect(Object.keys(AGENT_SYSTEMS)).toEqual(
      expect.arrayContaining(["claude-code", "cursor", "copilot", "windsurf", "codex"]),
    );
  });

  it("each entry has required fields", () => {
    for (const system of Object.values(AGENT_SYSTEMS)) {
      expect(system).toHaveProperty("name");
      expect(system).toHaveProperty("type");
      expect(system).toHaveProperty("instructionPath");
      expect(typeof system.appendable).toBe("boolean");
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

  it("detects claude-code by CLAUDE.md", () => {
    writeFileSync(join(tmp, "CLAUDE.md"), "");
    expect(detectAgents(tmp)).toContain("claude-code");
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

  it("detects copilot", () => {
    mkdirSync(join(tmp, ".github"), { recursive: true });
    writeFileSync(join(tmp, ".github", "copilot-instructions.md"), "");
    expect(detectAgents(tmp)).toContain("copilot");
  });

  it("detects windsurf", () => {
    writeFileSync(join(tmp, ".windsurfrules"), "");
    expect(detectAgents(tmp)).toContain("windsurf");
  });

  it("detects codex", () => {
    writeFileSync(join(tmp, "AGENTS.md"), "");
    expect(detectAgents(tmp)).toContain("codex");
  });

  it("detects multiple agents", () => {
    writeFileSync(join(tmp, "CLAUDE.md"), "");
    writeFileSync(join(tmp, "AGENTS.md"), "");
    const result = detectAgents(tmp);
    expect(result).toContain("claude-code");
    expect(result).toContain("codex");
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
