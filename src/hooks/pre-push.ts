import { existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "../utils/logger.js";

const HOOK_MARKER = "# skilled-pre-push-hook";

export function installHook(root: string): void {
  const hooksDir = join(root, ".git", "hooks");

  if (!existsSync(join(root, ".git"))) {
    throw new Error("Not a git repository. Run this from a git project root.");
  }

  mkdirSync(hooksDir, { recursive: true });

  const hookPath = join(hooksDir, "pre-push");
  const templatePath = join(
    fileURLToPath(import.meta.url),
    "..",
    "..",
    "..",
    "templates",
    "pre-push.sh",
  );

  // Read template
  let hookContent: string;
  if (existsSync(templatePath)) {
    hookContent = readFileSync(templatePath, "utf-8");
  } else {
    // Fallback inline template
    hookContent = getInlineTemplate();
  }

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, "utf-8");
    if (existing.includes(HOOK_MARKER)) {
      log.info("Pre-push hook already installed.");
      return;
    }
    // Append to existing hook
    writeFileSync(hookPath, existing + "\n\n" + hookContent);
  } else {
    writeFileSync(hookPath, hookContent);
  }

  chmodSync(hookPath, "755");
  log.success("Pre-push hook installed.");
}

function getInlineTemplate(): string {
  return `#!/bin/bash
${HOOK_MARKER}
# Checks for un-upstreamed skill changes before push.
# Installed by: skilled hooks install

if command -v skilled &> /dev/null; then
  skilled check 2>/dev/null
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "⚠  Some skills have conflicts or un-upstreamed local changes."
    echo "   Run 'skilled check' for details, or 'skilled upstream <skill>' to create a PR."
    echo ""
    # Warn but don't block the push
  fi
elif command -v npx &> /dev/null; then
  npx --yes skilled check 2>/dev/null
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "⚠  Some skills have conflicts or un-upstreamed local changes."
    echo "   Run 'skilled check' for details."
    echo ""
  fi
fi
`;
}
