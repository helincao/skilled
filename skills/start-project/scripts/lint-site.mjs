#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "fs";
import { basename, join, relative, resolve } from "path";

function printUsage() {
  console.log(`
skilled-lint-site

Usage:
  skilled-lint-site [--project-root <path>]

Options:
  --project-root <path>    Project root containing src/, _partials/, site.config.json
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

function loadJson(pathname, errors) {
  try {
    return JSON.parse(readFileSync(pathname, "utf8"));
  } catch (error) {
    pushIssue(errors, "error", pathname, `Invalid JSON: ${error.message}`);
    return null;
  }
}

function main() {
  const { projectRoot, help } = parseArgs(process.argv.slice(2));
  if (help) {
    printUsage();
    process.exit(0);
  }

  const root = resolve(projectRoot);
  const srcDir = join(root, "src");
  const partialsDir = join(root, "_partials");
  const siteConfigPath = join(root, "site.config.json");
  const headerPartial = join(partialsDir, "header.html");
  const footerPartial = join(partialsDir, "footer.html");

  const issues = [];

  if (!existsSync(srcDir)) {
    pushIssue(issues, "error", srcDir, "Missing src/ directory");
  }
  if (!existsSync(partialsDir)) {
    pushIssue(issues, "error", partialsDir, "Missing _partials/ directory");
  }
  if (!existsSync(siteConfigPath)) {
    pushIssue(issues, "error", siteConfigPath, "Missing site.config.json");
  }

  let siteConfig = null;
  if (existsSync(siteConfigPath)) {
    siteConfig = loadJson(siteConfigPath, issues);
  }

  if (siteConfig) {
    const requiredConfigFields = [
      "siteName",
      "baseUrl",
      "defaultDescription",
      "defaultOgImage",
      "locale",
    ];
    for (const field of requiredConfigFields) {
      if (typeof siteConfig[field] !== "string" || siteConfig[field].trim() === "") {
        pushIssue(issues, "error", siteConfigPath, `Missing or empty string field: ${field}`);
      }
    }

    if (typeof siteConfig.baseUrl === "string" && !/^https?:\/\//.test(siteConfig.baseUrl)) {
      pushIssue(issues, "warn", siteConfigPath, "baseUrl should start with http:// or https://");
    }
    if (
      typeof siteConfig.defaultOgImage === "string" &&
      !siteConfig.defaultOgImage.startsWith("/") &&
      !/^https?:\/\//.test(siteConfig.defaultOgImage)
    ) {
      pushIssue(
        issues,
        "warn",
        siteConfigPath,
        "defaultOgImage should be root-relative (/images/...) or absolute (https://...)",
      );
    }
  }

  if (existsSync(headerPartial)) {
    if (readFileSync(headerPartial, "utf8").trim() === "") {
      pushIssue(issues, "error", headerPartial, "header.html is empty");
    }
  } else if (existsSync(partialsDir)) {
    pushIssue(issues, "error", headerPartial, "Missing _partials/header.html");
  }

  if (existsSync(footerPartial)) {
    if (readFileSync(footerPartial, "utf8").trim() === "") {
      pushIssue(issues, "error", footerPartial, "footer.html is empty");
    }
  } else if (existsSync(partialsDir)) {
    pushIssue(issues, "error", footerPartial, "Missing _partials/footer.html");
  }

  if (existsSync(srcDir)) {
    const htmlFiles = findHtmlFiles(srcDir);

    if (htmlFiles.length === 0) {
      pushIssue(issues, "error", srcDir, "No HTML files found under src/");
    }

    for (const filePath of htmlFiles) {
      const html = readFileSync(filePath, "utf8");
      const relPath = relative(root, filePath).replace(/\\/g, "/");
      const fileName = basename(filePath);

      if (!/<!DOCTYPE html>/i.test(html)) {
        pushIssue(issues, "error", relPath, "Missing <!DOCTYPE html>");
      }
      if (!/<html\b/i.test(html)) {
        pushIssue(issues, "error", relPath, "Missing <html> tag");
      }
      if (!/<head\b/i.test(html)) {
        pushIssue(issues, "error", relPath, "Missing <head> tag");
      }
      if (!/<body\b/i.test(html)) {
        pushIssue(issues, "error", relPath, "Missing <body> tag");
      }
      if (!/<title>[\s\S]*?<\/title>/i.test(html)) {
        pushIssue(issues, "error", relPath, "Missing <title> tag");
      }
      if (!/<meta name="description"[^>]*>/i.test(html)) {
        pushIssue(issues, "warn", relPath, "Missing <meta name=\"description\"> tag");
      }

      const metaBlock = html.match(/<!--\s*meta\b([\s\S]*?)-->/);
      if (!metaBlock) {
        pushIssue(issues, "warn", relPath, "Missing <!-- meta --> block");
      } else {
        const metaLines = metaBlock[1].split("\n");
        const metaFields = {};
        for (const line of metaLines) {
          const match = line.match(/^\s*(\w[\w_]*)\s*:\s*(.+?)\s*$/);
          if (match) metaFields[match[1]] = match[2];
        }
        if (!metaFields.title) {
          pushIssue(issues, "warn", relPath, "Meta block missing title");
        }
        if (!metaFields.description) {
          pushIssue(issues, "warn", relPath, "Meta block missing description");
        }
      }

      const hasHeaderMarker = html.includes("HEADER (from _partials/header.html)");
      const hasFooterMarker = html.includes("FOOTER (from _partials/footer.html)");
      if (fileName === "index.html" && !hasHeaderMarker) {
        pushIssue(
          issues,
          "warn",
          relPath,
          "index.html missing header marker comment (partial injection may be skipped)",
        );
      }
      if (fileName === "index.html" && !hasFooterMarker) {
        pushIssue(
          issues,
          "warn",
          relPath,
          "index.html missing footer marker comment (partial injection may be skipped)",
        );
      }
    }
  }

  const errors = issues.filter((issue) => issue.type === "error");
  const warnings = issues.filter((issue) => issue.type === "warn");

  console.log(`\nskilled-lint-site — linting ${root}\n`);

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
