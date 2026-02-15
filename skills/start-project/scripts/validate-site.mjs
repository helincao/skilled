#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "fs";
import { join, relative, resolve } from "path";

function printUsage() {
  console.log(`
skilled-validate-site

Usage:
  skilled-validate-site [--project-root <path>]

Options:
  --project-root <path>    Project root containing src/, dist/, site.config.json
  -h, --help               Show this help
`);
}

function parseArgs(argv) {
  const args = { projectRoot: process.cwd(), help: false };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    if (token === "--project-root") {
      const value = argv[++i];
      if (!value || value.startsWith("-")) {
        console.error("Error: --project-root requires a path");
        printUsage();
        process.exit(1);
      }
      args.projectRoot = value;
      continue;
    }
    console.error(`Error: Unknown option "${token}"`);
    printUsage();
    process.exit(1);
  }

  return args;
}

function findHtmlFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findHtmlFiles(fullPath));
      continue;
    }
    if (entry.name.endsWith(".html")) {
      files.push(fullPath);
    }
  }
  return files;
}

function pushIssue(list, type, file, message) {
  list.push({ type, file, message });
}

function loadJson(pathname, issues) {
  try {
    return JSON.parse(readFileSync(pathname, "utf8"));
  } catch (error) {
    pushIssue(issues, "error", pathname, `Invalid JSON: ${error.message}`);
    return null;
  }
}

function countOccurrences(text, pattern) {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function main() {
  const { projectRoot, help } = parseArgs(process.argv.slice(2));
  if (help) {
    printUsage();
    process.exit(0);
  }

  const root = resolve(projectRoot);
  const srcDir = join(root, "src");
  const distDir = join(root, "dist");
  const siteConfigPath = join(root, "site.config.json");
  const sitemapPath = join(distDir, "sitemap.xml");
  const robotsPath = join(distDir, "robots.txt");
  const distInputCss = join(distDir, "css", "input.css");

  const issues = [];

  if (!existsSync(srcDir)) {
    pushIssue(issues, "error", srcDir, "Missing src/ directory");
  }
  if (!existsSync(distDir)) {
    pushIssue(
      issues,
      "error",
      distDir,
      "Missing dist/ directory. Run npm run build before validate:site.",
    );
  }
  if (!existsSync(siteConfigPath)) {
    pushIssue(issues, "error", siteConfigPath, "Missing site.config.json");
  }

  const siteConfig = existsSync(siteConfigPath) ? loadJson(siteConfigPath, issues) : null;

  if (existsSync(srcDir) && existsSync(distDir)) {
    const srcHtml = findHtmlFiles(srcDir);
    const distHtml = findHtmlFiles(distDir);

    const srcRelative = new Set(srcHtml.map((file) => relative(srcDir, file).replace(/\\/g, "/")));
    const distRelative = new Set(distHtml.map((file) => relative(distDir, file).replace(/\\/g, "/")));

    if (srcHtml.length === 0) {
      pushIssue(issues, "error", srcDir, "No HTML files found under src/");
    }

    if (distHtml.length !== srcHtml.length) {
      pushIssue(
        issues,
        "warn",
        distDir,
        `HTML file count differs (src: ${srcHtml.length}, dist: ${distHtml.length})`,
      );
    }

    for (const relPath of srcRelative) {
      if (!distRelative.has(relPath)) {
        pushIssue(issues, "error", join("dist", relPath), "Missing built HTML file");
      }
    }

    for (const filePath of distHtml) {
      const html = readFileSync(filePath, "utf8");
      const relPath = relative(root, filePath).replace(/\\/g, "/");

      if (!/<link rel="canonical" href="[^"]+">/i.test(html)) {
        pushIssue(issues, "error", relPath, "Missing canonical link");
      }
      if (!/<meta property="og:title" content="[^"]*">/i.test(html)) {
        pushIssue(issues, "error", relPath, "Missing og:title tag");
      }
      if (!/<meta property="og:description" content="[^"]*">/i.test(html)) {
        pushIssue(issues, "error", relPath, "Missing og:description tag");
      }
      if (!/<meta property="og:image" content="[^"]*">/i.test(html)) {
        pushIssue(issues, "error", relPath, "Missing og:image tag");
      }
      if (!/<meta name="twitter:card" content="summary_large_image">/i.test(html)) {
        pushIssue(issues, "error", relPath, "Missing twitter:card tag");
      }

      if (/(?:href|src)=["']\/(?!\/)/.test(html)) {
        pushIssue(issues, "warn", relPath, "Contains root-absolute href/src paths");
      }
    }
  }

  if (!existsSync(sitemapPath)) {
    pushIssue(issues, "error", sitemapPath, "Missing sitemap.xml");
  } else {
    const sitemap = readFileSync(sitemapPath, "utf8");
    const urlCount = countOccurrences(sitemap, /<url>/g);
    if (urlCount === 0) {
      pushIssue(issues, "error", sitemapPath, "No <url> entries found");
    }
  }

  if (!existsSync(robotsPath)) {
    pushIssue(issues, "error", robotsPath, "Missing robots.txt");
  } else {
    const robots = readFileSync(robotsPath, "utf8");
    if (!/Sitemap:\s+/i.test(robots)) {
      pushIssue(issues, "error", robotsPath, "robots.txt missing Sitemap directive");
    }
    if (siteConfig?.baseUrl && !robots.includes(`${siteConfig.baseUrl}/sitemap.xml`)) {
      pushIssue(
        issues,
        "warn",
        robotsPath,
        "Sitemap URL does not match site.config.json baseUrl",
      );
    }
  }

  if (existsSync(distInputCss)) {
    pushIssue(issues, "warn", relative(root, distInputCss), "dist/css/input.css should not be shipped");
  }

  const errors = issues.filter((issue) => issue.type === "error");
  const warnings = issues.filter((issue) => issue.type === "warn");

  console.log(`\nskilled-validate-site — validating ${root}\n`);

  if (errors.length === 0 && warnings.length === 0) {
    console.log("No issues found.");
    process.exit(0);
  }

  for (const issue of issues) {
    const prefix = issue.type === "error" ? "error" : "warn ";
    console.log(`${prefix}  ${issue.file}: ${issue.message}`);
  }

  console.log("");
  console.log(`Summary: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(errors.length === 0 ? 0 : 1);
}

main();
