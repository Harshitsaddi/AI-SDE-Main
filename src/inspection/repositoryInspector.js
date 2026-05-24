import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target",
  "vendor"
]);

const IMPORTANT_FILES = new Set([
  ".eslintrc",
  ".eslintrc.cjs",
  ".eslintrc.js",
  ".eslintrc.json",
  "Cargo.toml",
  "Gemfile",
  "README",
  "README.md",
  "build.gradle",
  "composer.json",
  "eslint.config.js",
  "go.mod",
  "package-lock.json",
  "package.json",
  "pnpm-lock.yaml",
  "pom.xml",
  "pyproject.toml",
  "requirements.txt",
  "tsconfig.json",
  "yarn.lock"
]);

const TEXT_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".css",
  ".go",
  ".h",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".py",
  ".rs",
  ".ts",
  ".tsx",
  ".txt",
  ".vue",
  ".yaml",
  ".yml"
]);

const STOP_WORDS = new Set([
  "after",
  "from",
  "have",
  "into",
  "issue",
  "that",
  "the",
  "this",
  "when",
  "with"
]);

function toRepoPath(rootPath, filePath) {
  return path.relative(rootPath, filePath).replace(/\\/g, "/");
}

async function walkFiles(rootPath, maxFiles) {
  const files = [];
  const stack = [rootPath];

  while (stack.length && files.length < maxFiles) {
    const current = stack.pop();
    const entries = await readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name)) {
          stack.push(fullPath);
        }
        continue;
      }

      if (entry.isFile()) {
        files.push(toRepoPath(rootPath, fullPath));

        if (files.length >= maxFiles) {
          break;
        }
      }
    }
  }

  return files.sort();
}

async function readImportantFiles(rootPath, fileTree) {
  const important = [];

  for (const repoPath of fileTree) {
    const baseName = path.basename(repoPath);
    if (!IMPORTANT_FILES.has(baseName)) {
      continue;
    }

    const absolutePath = path.join(rootPath, repoPath);
    const content = await readFile(absolutePath, "utf8");
    important.push({
      path: repoPath,
      content: content.slice(0, 4000),
      truncated: content.length > 4000
    });
  }

  return important;
}

function parsePackageJson(importantFiles) {
  const packageFile = importantFiles.find((file) => file.path === "package.json");

  if (!packageFile) {
    return null;
  }

  try {
    return JSON.parse(packageFile.content);
  } catch {
    return null;
  }
}

function detectPackageManager(fileTree) {
  if (fileTree.includes("pnpm-lock.yaml")) {
    return "pnpm";
  }

  if (fileTree.includes("yarn.lock")) {
    return "yarn";
  }

  if (fileTree.includes("package-lock.json")) {
    return "npm";
  }

  if (fileTree.includes("package.json")) {
    return "npm";
  }

  return null;
}

function detectTechStack(fileTree) {
  const stack = [];

  if (fileTree.includes("package.json")) stack.push("node");
  if (fileTree.includes("tsconfig.json")) stack.push("typescript");
  if (fileTree.includes("pyproject.toml") || fileTree.includes("requirements.txt")) stack.push("python");
  if (fileTree.includes("go.mod")) stack.push("go");
  if (fileTree.includes("Cargo.toml")) stack.push("rust");
  if (fileTree.includes("pom.xml") || fileTree.includes("build.gradle")) stack.push("java");
  if (fileTree.includes("Gemfile")) stack.push("ruby");

  return stack;
}

function validationCommandsFor({ fileTree, packageJson }) {
  const commands = [];
  const packageManager = detectPackageManager(fileTree);

  if (packageJson?.scripts && packageManager) {
    for (const script of ["test", "lint", "typecheck", "build"]) {
      if (packageJson.scripts[script]) {
        commands.push(script === "test" ? `${packageManager} test` : `${packageManager} run ${script}`);
      }
    }
  }

  if (fileTree.includes("go.mod")) {
    commands.push("go test ./...");
  }

  if (fileTree.includes("Cargo.toml")) {
    commands.push("cargo test");
  }

  if (fileTree.includes("pyproject.toml") || fileTree.includes("requirements.txt")) {
    commands.push("python -m pytest");
  }

  return [...new Set(commands)];
}

function searchTerms(issue) {
  const text = `${issue.title || ""} ${issue.body || ""}`.toLowerCase();
  return [...new Set(text.match(/[a-z0-9_/-]{4,}/g) || [])]
    .filter((term) => !STOP_WORDS.has(term))
    .slice(0, 12);
}

async function searchFiles({ rootPath, fileTree, terms }) {
  if (!terms.length) {
    return [];
  }

  const matches = [];

  for (const repoPath of fileTree) {
    if (matches.length >= 20) {
      break;
    }

    const extension = path.extname(repoPath);
    if (!TEXT_EXTENSIONS.has(extension)) {
      continue;
    }

    const absolutePath = path.join(rootPath, repoPath);
    const stats = await stat(absolutePath);
    if (stats.size > 200_000) {
      continue;
    }

    const content = await readFile(absolutePath, "utf8");
    const lines = content.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].toLowerCase();
      const matchedTerm = terms.find((term) => line.includes(term));

      if (matchedTerm) {
        matches.push({
          path: repoPath,
          line: index + 1,
          term: matchedTerm,
          snippet: lines[index].trim().slice(0, 240)
        });
        break;
      }
    }
  }

  return matches;
}

export async function inspectLocalRepository({ config, workflow }) {
  if (!workflow.workspace?.path) {
    throw new Error("Workflow workspace path is required for repository inspection");
  }

  if (!workflow.workspace.repositoryCheckedOut) {
    return {
      provider: "local",
      inspected: false,
      reason: "repository_not_checked_out",
      fileTree: [],
      importantFiles: [],
      techStack: [],
      validationCommands: [],
      searchMatches: []
    };
  }

  const rootPath = workflow.workspace.path;
  const fileTree = await walkFiles(rootPath, config.inspectionMaxFiles);
  const importantFiles = await readImportantFiles(rootPath, fileTree);
  const packageJson = parsePackageJson(importantFiles);
  const terms = searchTerms(workflow.planningInput.issue);

  return {
    provider: "local",
    inspected: true,
    rootPath,
    fileTree,
    importantFiles,
    techStack: detectTechStack(fileTree),
    validationCommands: validationCommandsFor({ fileTree, packageJson }),
    searchTerms: terms,
    searchMatches: await searchFiles({ rootPath, fileTree, terms })
  };
}
