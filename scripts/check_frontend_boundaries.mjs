#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const webSrc = path.join(repoRoot, "apps/web/src");

const safeExec = (cmd) => {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
};

const resolveBase = () => {
  const explicitBaseRef = process.env.GITHUB_BASE_REF;
  if (explicitBaseRef) {
    const mergeBase = safeExec(`git merge-base HEAD origin/${explicitBaseRef}`);
    if (mergeBase) return mergeBase;
  }
  const mainMergeBase = safeExec("git merge-base HEAD origin/main");
  if (mainMergeBase) return mainMergeBase;
  const prev = safeExec("git rev-parse HEAD~1");
  return prev || "HEAD";
};

const base = resolveBase();
const changedFilesFromBase = safeExec(
  `git diff --name-only --diff-filter=AMR ${base}...HEAD`,
)
  .split("\n")
  .map((file) => file.trim())
  .filter(Boolean);

const changedFilesLocal = safeExec("git diff --name-only --diff-filter=AMR HEAD")
  .split("\n")
  .map((file) => file.trim())
  .filter(Boolean);

const changedFiles = [...new Set([...changedFilesFromBase, ...changedFilesLocal])]
  .filter((file) => file.startsWith("apps/web/src/"))
  .filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));

if (changedFiles.length === 0) {
  console.log("Frontend boundaries: no changed web source files.");
  process.exit(0);
}

const importRegex = /(?:import\s+[\s\S]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\))/g;

const layerOf = (relPath) => {
  const normalized = relPath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  const idx = parts.indexOf("src");
  if (idx === -1 || idx + 1 >= parts.length) return "unknown";
  return parts[idx + 1];
};

const toAbsoluteImport = (sourceFile, specifier) => {
  if (specifier.startsWith("@/")) {
    return path.join(webSrc, specifier.slice(2));
  }
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    return path.resolve(path.dirname(sourceFile), specifier);
  }
  return null;
};

const inferImportLayer = (sourceFile, specifier) => {
  const abs = toAbsoluteImport(sourceFile, specifier);
  if (!abs) return null;

  const candidates = [abs, `${abs}.ts`, `${abs}.tsx`, `${abs}.js`, `${abs}.jsx`, path.join(abs, "index.ts"), path.join(abs, "index.tsx")];
  const existing = candidates.find((candidate) => fs.existsSync(candidate));
  const target = existing ?? abs;
  return layerOf(path.relative(repoRoot, target));
};

const violations = [];

for (const relFile of changedFiles) {
  const absFile = path.join(repoRoot, relFile);
  const fileLayer = layerOf(relFile);
  const src = fs.readFileSync(absFile, "utf8");

  const imports = [];
  for (const match of src.matchAll(importRegex)) {
    const spec = match[1] ?? match[2];
    if (spec) imports.push(spec);
  }

  for (const specifier of imports) {
    const importedLayer = inferImportLayer(absFile, specifier);
    if (!importedLayer) continue;

    if (fileLayer !== "pages" && importedLayer === "pages") {
      violations.push(`${relFile}: non-page layer '${fileLayer}' cannot import pages ('${specifier}')`);
      continue;
    }

    if (fileLayer === "features" && importedLayer === "pages") {
      violations.push(`${relFile}: features cannot depend on pages ('${specifier}')`);
      continue;
    }

    if (fileLayer === "components" && (importedLayer === "features" || importedLayer === "pages")) {
      violations.push(`${relFile}: components cannot import ${importedLayer} ('${specifier}')`);
      continue;
    }

    if (fileLayer === "pages" && importedLayer === "pages") {
      const fileParts = relFile.split("/");
      const pagesIdx = fileParts.indexOf("pages");
      const thisPage =
        pagesIdx >= 0 && pagesIdx + 1 < fileParts.length
          ? fileParts[pagesIdx + 1]
          : "";

      const targetAbs = toAbsoluteImport(absFile, specifier);
      const targetParts = targetAbs
        ? path.relative(webSrc, targetAbs).split("/")
        : [];
      const targetPage =
        targetParts[0] === "pages" && targetParts.length > 1
          ? targetParts[1]
          : "";

      if (thisPage && targetPage && thisPage !== targetPage) {
        violations.push(`${relFile}: cross-page import from '${thisPage}' to '${targetPage}' is not allowed ('${specifier}')`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Frontend architecture boundary violations:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(`Frontend boundaries check passed for ${changedFiles.length} changed files.`);
