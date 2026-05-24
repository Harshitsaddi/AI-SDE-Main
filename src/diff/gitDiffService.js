import { runCommand } from "../system/commandRunner.js";

function parsePorcelainStatus(stdout) {
  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => ({
      status: line.slice(0, 2).trim(),
      path: line.slice(3).trim()
    }));
}

export async function captureGitDiff({ config, workflow, commandRunner = runCommand }) {
  if (!workflow.workspace?.path) {
    throw new Error("Workflow workspace path is required for diff capture");
  }

  if (!workflow.workspace.repositoryCheckedOut) {
    return {
      provider: "git",
      captured: false,
      reason: "repository_not_checked_out",
      changedFiles: [],
      diffStat: "",
      diff: "",
      truncated: false
    };
  }

  const status = await commandRunner("git", ["status", "--porcelain"], {
    cwd: workflow.workspace.path
  });
  const changedFiles = parsePorcelainStatus(status.stdout);

  if (!changedFiles.length) {
    return {
      provider: "git",
      captured: true,
      changedFiles: [],
      diffStat: "",
      diff: "",
      truncated: false
    };
  }

  const diffStat = await commandRunner("git", ["diff", "--stat"], {
    cwd: workflow.workspace.path
  });
  const diff = await commandRunner("git", ["diff", "--"], {
    cwd: workflow.workspace.path
  });
  const maxBytes = config.diffMaxBytes;
  const truncated = Buffer.byteLength(diff.stdout, "utf8") > maxBytes;

  return {
    provider: "git",
    captured: true,
    changedFiles,
    diffStat: diffStat.stdout,
    diff: truncated ? diff.stdout.slice(0, maxBytes) : diff.stdout,
    truncated
  };
}
