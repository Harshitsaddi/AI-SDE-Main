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

function parseNameStatus(stdout) {
  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [status, ...pathParts] = line.split(/\t+/);
      return {
        status,
        path: pathParts.join("\t").trim()
      };
    });
}

async function captureCommittedBranchDiff({ config, workflow, commandRunner }) {
  const baseBranch = workflow.branch?.baseBranch || workflow.planningInput?.repository?.defaultBranch;

  if (!baseBranch) {
    return null;
  }

  await commandRunner("git", ["fetch", "origin", baseBranch, "--depth", "1"], {
    cwd: workflow.workspace.path
  });

  const range = `FETCH_HEAD...HEAD`;
  const changed = await commandRunner("git", ["diff", "--name-status", range], {
    cwd: workflow.workspace.path
  });
  const changedFiles = parseNameStatus(changed.stdout);

  if (!changedFiles.length) {
    return null;
  }

  const diffStat = await commandRunner("git", ["diff", "--stat", range], {
    cwd: workflow.workspace.path
  });
  const diff = await commandRunner("git", ["diff", range, "--"], {
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
    truncated,
    comparison: range
  };
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

  const committedBranchDiff = await captureCommittedBranchDiff({ config, workflow, commandRunner });
  if (committedBranchDiff) {
    return committedBranchDiff;
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
