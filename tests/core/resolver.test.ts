import { describe, it, expect } from "vitest";
import {
  resolveRepo,
  findSkillsRoot,
  isLocalPath,
  encodeLocalRepo,
  decodeLocalRepo,
} from "../../src/core/resolver.js";

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

describe("isLocalPath", () => {
  it("recognises absolute paths", () => {
    expect(isLocalPath("/home/user/skills")).toBe(true);
    expect(isLocalPath("/")).toBe(true);
  });

  it("recognises relative paths starting with ./", () => {
    expect(isLocalPath("./skills")).toBe(true);
    expect(isLocalPath("./")).toBe(true);
  });

  it("recognises parent-relative paths starting with ../", () => {
    expect(isLocalPath("../sibling-repo")).toBe(true);
    expect(isLocalPath("../../nested")).toBe(true);
  });

  it("recognises bare . and ..", () => {
    expect(isLocalPath(".")).toBe(true);
    expect(isLocalPath("..")).toBe(true);
  });

  it("does not match owner/repo shorthand", () => {
    expect(isLocalPath("owner/repo")).toBe(false);
  });

  it("does not match HTTPS URLs", () => {
    expect(isLocalPath("https://github.com/owner/repo")).toBe(false);
  });

  it("does not match SSH URLs", () => {
    expect(isLocalPath("git@github.com:owner/repo.git")).toBe(false);
  });
});

describe("encodeLocalRepo / decodeLocalRepo", () => {
  it("encodes an absolute path with a file: prefix", () => {
    expect(encodeLocalRepo("/home/user/skills")).toBe("file:/home/user/skills");
  });

  it("decodes a file: URI back to the path", () => {
    expect(decodeLocalRepo("file:/home/user/skills")).toBe("/home/user/skills");
  });

  it("returns null for non-local repo strings", () => {
    expect(decodeLocalRepo("owner/repo")).toBeNull();
    expect(decodeLocalRepo("https://github.com/owner/repo")).toBeNull();
  });

  it("round-trips correctly", () => {
    const original = "/var/tmp/my-skills-repo";
    expect(decodeLocalRepo(encodeLocalRepo(original))).toBe(original);
  });
});
