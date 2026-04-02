import { existsSync, cpSync } from "node:fs";
import { join } from "node:path";
import simpleGit from "simple-git";
import { readLockfile } from "../core/manifest.js";
import { resolveRepo, findSkillsRoot } from "../core/resolver.js";
import { shallowClone } from "../core/git.js";
import { hashDirectory } from "../core/hash.js";
import {
  ensureFork,
  createPullRequest,
  getDefaultBranch,
  findExistingPR,
  remoteBranchExists,
} from "../core/github.js";
import { skillsDir } from "../utils/config.js";
import { log } from "../utils/logger.js";

export async function upstream(
  root: string,
  skillName: string,
): Promise<void> {
  const lockfile = readLockfile(root);
  const entry = lockfile.skills[skillName];

  if (!entry) {
    throw new Error(
      `Skill "${skillName}" is not tracked. Run \`skilled list\` to see tracked skills.`,
    );
  }

  const localDir = join(skillsDir(root), skillName);
  if (!existsSync(localDir)) {
    throw new Error(`Local skill directory not found: ${localDir}`);
  }

  // Verify there are local changes
  const currentHash = hashDirectory(localDir);
  if (currentHash === entry.installedHash) {
    log.info(`No local changes to upstream for "${skillName}".`);
    return;
  }

  const resolved = resolveRepo(entry.repo);

  // 1. Ensure we have a fork
  log.step("Ensuring fork exists...");
  const fork = await ensureFork(resolved.owner, resolved.repo);

  // 2. Get the default branch
  const defaultBranch = await getDefaultBranch(resolved.owner, resolved.repo);

  // 3. Use a deterministic branch name so re-runs reuse the same branch
  const branchName = `skilled/update-${skillName}`;
  const headRef = `${fork.owner}:${branchName}`;

  // 4. Check if an open PR already exists for this branch
  const existingPR = await findExistingPR(
    resolved.owner,
    resolved.repo,
    headRef,
  );

  if (existingPR) {
    log.success(`An open PR already exists: ${existingPR}`);
    log.info("Push updates to the existing branch to update the PR, or close it to create a new one.");
    return;
  }

  // 5. Clone the fork
  log.step(`Cloning fork ${fork.owner}/${fork.repo}...`);
  const forkUrl = `https://github.com/${fork.owner}/${fork.repo}.git`;
  const clone = await shallowClone(forkUrl);

  try {
    const git = simpleGit(clone.dir);

    // 6. Create or switch to the branch
    const branchExistsOnRemote = await remoteBranchExists(
      fork.owner,
      fork.repo,
      branchName,
    );

    if (branchExistsOnRemote) {
      log.dim(`Branch ${branchName} exists on remote, will force-update it.`);
    }

    await git.checkoutLocalBranch(branchName);

    // 7. Copy local skill → fork clone
    const remoteSkillDir = join(findSkillsRoot(clone.dir), skillName);
    cpSync(localDir, remoteSkillDir, { recursive: true });

    // 8. Commit
    await git.add(".");
    const status = await git.status();
    if (status.files.length === 0) {
      log.info("No diff detected after copying. Skills may already be in sync.");
      return;
    }

    await git.commit(`Update skill: ${skillName}\n\nUpstreamed via skilled CLI`);

    // 9. Push to fork (force-push to handle re-runs where branch already exists)
    log.step("Pushing to fork...");
    await git.push("origin", branchName, ["--set-upstream", "--force-with-lease"]);

    // 10. Create PR
    log.step("Creating pull request...");
    const prUrl = await createPullRequest({
      owner: resolved.owner,
      repo: resolved.repo,
      title: `Update skill: ${skillName}`,
      body: [
        `## Summary`,
        ``,
        `Local changes to the \`${skillName}\` skill, upstreamed via [skilled](https://github.com/helincao/skilled) CLI.`,
        ``,
        `**Source commit:** ${entry.commitSha.slice(0, 7)}`,
        `**Local hash:** ${currentHash}`,
      ].join("\n"),
      head: headRef,
      base: defaultBranch,
    });

    log.success(`Pull request created: ${prUrl}`);
  } finally {
    clone.cleanup();
  }
}
