import { describe, it, expect } from "vitest";
import { resolveRepo, findSkillsRoot } from "../../src/core/resolver.js";

describe("resolveRepo", () => {
  it("parses owner/repo shorthand", () => {
    const result = resolveRepo("helincao/skilled");
    expect(result).toEqual({
      slug: "helincao/skilled",
      cloneUrl: "https://github.com/helincao/skilled.git",
      owner: "helincao",
      repo: "skilled",
    });
  });

  it("parses HTTPS URL", () => {
    const result = resolveRepo("https://github.com/helincao/skilled");
    expect(result.slug).toBe("helincao/skilled");
    expect(result.cloneUrl).toContain(".git");
    expect(result.owner).toBe("helincao");
    expect(result.repo).toBe("skilled");
  });

  it("parses HTTPS URL with .git suffix", () => {
    const result = resolveRepo("https://github.com/helincao/skilled.git");
    expect(result.slug).toBe("helincao/skilled");
    expect(result.owner).toBe("helincao");
    expect(result.repo).toBe("skilled");
  });

  it("parses HTTPS URL with trailing slash", () => {
    const result = resolveRepo("https://github.com/helincao/skilled/");
    expect(result.slug).toBe("helincao/skilled");
  });

  it("parses SSH URL", () => {
    const result = resolveRepo("git@github.com:helincao/skilled.git");
    expect(result).toEqual({
      slug: "helincao/skilled",
      cloneUrl: "git@github.com:helincao/skilled.git",
      owner: "helincao",
      repo: "skilled",
    });
  });

  it("parses SSH URL without .git suffix", () => {
    const result = resolveRepo("git@github.com:helincao/skilled");
    expect(result.slug).toBe("helincao/skilled");
    expect(result.cloneUrl).toBe("git@github.com:helincao/skilled.git");
  });

  it("parses SSH URL with non-github host", () => {
    const result = resolveRepo("git@gitlab.com:org/repo.git");
    expect(result.slug).toBe("org/repo");
    expect(result.cloneUrl).toBe("git@gitlab.com:org/repo.git");
  });

  it("throws on invalid input", () => {
    expect(() => resolveRepo("not-a-repo")).toThrow("Cannot resolve repo");
  });

  it("throws on bare word", () => {
    expect(() => resolveRepo("skilled")).toThrow();
  });
});

describe("findSkillsRoot", () => {
  it("returns skills/ subdirectory of clone dir", () => {
    expect(findSkillsRoot("/tmp/clone")).toBe("/tmp/clone/skills");
  });
});
