#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const BUILD_SCRIPT = resolve(SCRIPT_DIR, "..", "..", "build", "scripts", "build.mjs");

function printUsage() {
  console.log(`
skilled-start-project

Legacy scaffolding fallback for start-project.

Usage:
  skilled-start-project --name <site-name> [options]

Options:
  --name, -n <text>           Site name (required)
  --description, -d <text>    Default site description
  --base-url, -u <url>        Canonical base URL (default: https://example.com)
  --locale, -l <locale>       Locale for OG metadata (default: en_US)
  --project-root <path>       Root directory to scaffold (default: current directory)
  --force                     Overwrite existing scaffold files
  --build                     Run build after scaffolding (prefers installed build skill script)
  -h, --help                  Show help
`);
}

function parseArgs(argv) {
  const args = {
    siteName: null,
    description: null,
    baseUrl: "https://example.com",
    locale: "en_US",
    projectRoot: process.cwd(),
    force: false,
    build: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    if (token === "--force") {
      args.force = true;
      continue;
    }
    if (token === "--build") {
      args.build = true;
      continue;
    }

    const nextValue = () => {
      const value = argv[++i];
      if (!value || value.startsWith("-")) {
        console.error(`Error: Missing value for ${token}`);
        printUsage();
        process.exit(1);
      }
      return value;
    };

    switch (token) {
      case "--name":
      case "-n":
        args.siteName = nextValue();
        break;
      case "--description":
      case "-d":
        args.description = nextValue();
        break;
      case "--base-url":
      case "-u":
        args.baseUrl = nextValue();
        break;
      case "--locale":
      case "-l":
        args.locale = nextValue();
        break;
      case "--project-root":
        args.projectRoot = nextValue();
        break;
      default:
        console.error(`Error: Unknown option "${token}"`);
        printUsage();
        process.exit(1);
    }
  }

  return args;
}

function normalizeBaseUrl(url) {
  const trimmed = (url || "").trim();
  if (!trimmed) return "https://example.com";
  return trimmed.replace(/\/+$/, "");
}

function ensureDir(pathname) {
  if (!existsSync(pathname)) {
    mkdirSync(pathname, { recursive: true });
  }
}

function writeFileSafe(pathname, content, force, created, skipped) {
  ensureDir(dirname(pathname));
  if (existsSync(pathname) && !force) {
    skipped.push(pathname);
    return;
  }
  writeFileSync(pathname, content);
  created.push(pathname);
}

function headerMarker() {
  return `<!-- ============================================================
     HEADER (from _partials/header.html)
     ============================================================ -->`;
}

function footerMarker() {
  return `<!-- ============================================================
     FOOTER (from _partials/footer.html)
     ============================================================ -->`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function generateSiteConfig({ siteName, description, baseUrl, locale }) {
  return `${JSON.stringify(
    {
      siteName,
      baseUrl,
      defaultDescription: description,
      defaultOgImage: "/images/og-default.png",
      locale,
    },
    null,
    2,
  )}\n`;
}

function generateHeader(siteName) {
  const safeSiteName = escapeHtml(siteName);
  return `<header>
  <div class="container site-header">
    <a class="site-brand" href="/">${safeSiteName}</a>
    <nav aria-label="Primary">
      <a href="/">Home</a>
    </nav>
  </div>
</header>
`;
}

function generateFooter(siteName) {
  const safeSiteName = escapeHtml(siteName);
  const year = new Date().getFullYear();
  return `<footer>
  <div class="container site-footer">
    <p>&copy; ${year} ${safeSiteName}</p>
  </div>
</footer>
`;
}

function generateIndexHtml({ siteName, description }) {
  const safeSiteName = escapeHtml(siteName);
  const safeDescription = escapeHtml(description);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeSiteName}</title>
  <meta name="description" content="${safeDescription}">
  <link rel="stylesheet" href="/css/site.css">
</head>
<body>
  <!-- meta
  title: ${safeSiteName}
  description: ${safeDescription}
  og_image: /images/og-default.png
  -->

  ${headerMarker()}
  <header>
    <div class="container site-header">
      <a class="site-brand" href="/">${safeSiteName}</a>
      <nav aria-label="Primary">
        <a href="/">Home</a>
      </nav>
    </div>
  </header>

  <main class="container page-main">
    <h1>${safeSiteName}</h1>
    <p>${safeDescription}</p>
  </main>

  ${footerMarker()}
  <footer>
    <div class="container site-footer">
      <p>&copy; ${new Date().getFullYear()} ${safeSiteName}</p>
    </div>
  </footer>
</body>
</html>
`;
}

function generateInputCss() {
  return `:root {
  --color-bg: #f8f6f2;
  --color-surface: #ffffff;
  --color-text: #1e2430;
  --color-muted: #5a6370;
  --color-accent: #0d7660;
  --color-border: #dfe5ee;
  --radius-md: 12px;
  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --max-width: 960px;
}
`;
}

function generateSiteCss() {
  return `:root {
  --color-bg: #f8f6f2;
  --color-surface: #ffffff;
  --color-text: #1e2430;
  --color-muted: #5a6370;
  --color-accent: #0d7660;
  --color-border: #dfe5ee;
  --radius-md: 12px;
  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --max-width: 960px;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: var(--color-bg);
  color: var(--color-text);
  line-height: 1.6;
}

.container {
  width: min(100% - (2 * var(--space-2)), var(--max-width));
  margin: 0 auto;
}

.site-header,
.site-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3) 0;
}

.site-brand {
  color: var(--color-text);
  text-decoration: none;
  font-weight: 700;
}

nav a {
  color: var(--color-accent);
  text-decoration: none;
}

.page-main {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin: var(--space-3) auto;
}

.site-footer {
  border-top: 1px solid var(--color-border);
}

.site-footer p {
  margin: 0;
  color: var(--color-muted);
}
`;
}

function scaffoldProject(args) {
  const root = resolve(args.projectRoot);
  const siteName = args.siteName.trim();
  const description = (args.description || `${siteName} official website.`).trim();
  const baseUrl = normalizeBaseUrl(args.baseUrl);
  const locale = (args.locale || "en_US").trim();
  const force = args.force;

  const created = [];
  const skipped = [];

  const files = [
    {
      path: join(root, "site.config.json"),
      content: generateSiteConfig({ siteName, description, baseUrl, locale }),
    },
    { path: join(root, "_partials", "header.html"), content: generateHeader(siteName) },
    { path: join(root, "_partials", "footer.html"), content: generateFooter(siteName) },
    { path: join(root, "src", "index.html"), content: generateIndexHtml({ siteName, description }) },
    { path: join(root, "src", "css", "input.css"), content: generateInputCss() },
    { path: join(root, "src", "css", "site.css"), content: generateSiteCss() },
    { path: join(root, "src", "js", ".gitkeep"), content: "" },
    { path: join(root, "src", "images", ".gitkeep"), content: "" },
    { path: join(root, "content", ".gitkeep"), content: "" },
  ];

  for (const file of files) {
    writeFileSafe(file.path, file.content, force, created, skipped);
  }

  return { root, created, skipped };
}

function runBuild(projectRoot) {
  if (!existsSync(BUILD_SCRIPT)) {
    console.error("Build skill script not found.");
    console.error(`Expected: ${BUILD_SCRIPT}`);
    console.error("Install the build skill before using --build.");
    process.exit(1);
  }

  const result = spawnSync("node", [BUILD_SCRIPT, "--project-root", projectRoot], {
    cwd: projectRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) {
    console.error(`Failed to run build: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (!args.siteName || !args.siteName.trim()) {
    console.error("Error: --name is required.");
    printUsage();
    process.exit(1);
  }

  console.log("Note: start-project is now agent-first. This CLI is a legacy fallback scaffold path.");

  const { root, created, skipped } = scaffoldProject(args);

  console.log(`Scaffolded project in ${root}`);
  console.log(`  Created/updated: ${created.length}`);
  if (created.length > 0) {
    for (const file of created) {
      console.log(`    - ${file}`);
    }
  }
  if (skipped.length > 0) {
    console.log(`  Skipped existing: ${skipped.length}`);
    for (const file of skipped) {
      console.log(`    - ${file}`);
    }
    console.log("  Use --force to overwrite skipped files.");
  }

  if (args.build) {
    console.log("Running build...");
    runBuild(root);
  } else {
    if (existsSync(BUILD_SCRIPT)) {
      console.log(`Next step: node "${BUILD_SCRIPT}" --project-root "${root}"`);
    } else {
      console.log("Next step: install the build skill, then run its build script.");
    }
  }
}

main();
