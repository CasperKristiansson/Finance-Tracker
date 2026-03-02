#!/usr/bin/env node
import { execSync } from "node:child_process";

const MAX_LINES = 1200;
const MAX_COMPLEXITY = 180;
const MAX_LINE_GROWTH_OVER_BUDGET = 40;
const MAX_COMPLEXITY_GROWTH_OVER_BUDGET = 8;

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

const changedFromBase = safeExec(`git diff --name-only --diff-filter=AMR ${base}...HEAD`)
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);
const changedLocal = safeExec("git diff --name-only --diff-filter=AMR HEAD")
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

const changedFiles = [...new Set([...changedFromBase, ...changedLocal])]
  .filter((file) => /\.(ts|tsx|js|jsx|py)$/.test(file))
  .filter((file) => file.startsWith("apps/web/src/") || file.startsWith("apps/api/"))
  .filter((file) => !file.startsWith("apps/web/src/types/generated/contracts/"));

if (changedFiles.length === 0) {
  console.log("Changed-file budget check: no changed source files.");
  process.exit(0);
}

const readCurrent = (file) => safeExec(`cat ${JSON.stringify(file)}`);
const readBase = (file) => safeExec(`git show ${base}:${file}`);

const countComplexity = (source) => {
  const pattern = /\bif\b|\bfor\b|\bwhile\b|\bcase\b|\bcatch\b|\?\s*[^:]+:|&&|\|\|/g;
  const matches = source.match(pattern);
  return matches ? matches.length : 0;
};

const violations = [];

for (const file of changedFiles) {
  const current = readCurrent(file);
  if (!current) continue;

  const baseContent = readBase(file);
  const currentLines = current.split("\n").length;
  const baseLines = baseContent ? baseContent.split("\n").length : 0;

  const currentComplexity = countComplexity(current);
  const baseComplexity = countComplexity(baseContent);

  const lineGrowth = currentLines - baseLines;
  const complexityGrowth = currentComplexity - baseComplexity;

  if (currentLines > MAX_LINES && lineGrowth > MAX_LINE_GROWTH_OVER_BUDGET) {
    violations.push(
      `${file}: line budget exceeded (${currentLines} lines, +${lineGrowth}; budget ${MAX_LINES}, allowed growth ${MAX_LINE_GROWTH_OVER_BUDGET})`,
    );
  }

  if (
    currentComplexity > MAX_COMPLEXITY &&
    complexityGrowth > MAX_COMPLEXITY_GROWTH_OVER_BUDGET
  ) {
    violations.push(
      `${file}: complexity budget exceeded (score ${currentComplexity}, +${complexityGrowth}; budget ${MAX_COMPLEXITY}, allowed growth ${MAX_COMPLEXITY_GROWTH_OVER_BUDGET})`,
    );
  }
}

if (violations.length > 0) {
  console.error("Changed-file budget violations:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(`Changed-file budgets check passed for ${changedFiles.length} files.`);
