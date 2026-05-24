import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { runCommand } from "../system/commandRunner.js";
import { workspaceNameForWorkflow } from "./workspaceNames.js";

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function isGitWorkspace(workspacePath) {
  return pathExists(path.join(workspacePath, ".git"));
}

function checkoutUrlForWorkflow(workflow) {
  const cloneUrl = workflow.planningInput.repository.cloneUrl;

  if (!cloneUrl) {
    throw new Error("Repository clone URL is required for WORKSPACE_PROVIDER=git");
  }

  return cloneUrl;
}

async function writeWorkspaceMetadata({ workflow, workspacePath, workspaceName, refreshed }) {
  const metadataPath = path.join(workspacePath, "metadata.json");
  const metadata = {
    workflowId: workflow.id,
    repository: workflow.planningInput.repository.fullName,
    branchName: workflow.branch.branchName,
    baseBranch: workflow.branch.baseBranch,
    provider: "git",
    repositoryCheckedOut: true,
    refreshed,
    preparedAt: new Date().toISOString()
  };

  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  return {
    provider: "git",
    workspaceName,
    path: workspacePath,
    metadataPath,
    repositoryCheckedOut: true,
    refreshed
  };
}

export async function prepareGitWorkspace({ config, workflow, commandRunner = runCommand }) {
  const workspaceName = workspaceNameForWorkflow(workflow);
  const workspaceRoot = path.resolve(config.workspaceRoot);
  const workspacePath = path.join(workspaceRoot, workspaceName);
  const branchName = workflow.branch.branchName;
  const cloneUrl = checkoutUrlForWorkflow(workflow);

  await mkdir(workspaceRoot, { recursive: true });

  if (await isGitWorkspace(workspacePath)) {
    await commandRunner("git", ["fetch", "origin", branchName, "--depth", "1"], {
      cwd: workspacePath
    });
    await commandRunner("git", ["checkout", "-B", branchName, "FETCH_HEAD"], {
      cwd: workspacePath
    });

    return writeWorkspaceMetadata({
      workflow,
      workspacePath,
      workspaceName,
      refreshed: true
    });
  }

  if (await pathExists(workspacePath)) {
    throw new Error(`Workspace path already exists and is not a git repository: ${workspacePath}`);
  }

  await commandRunner("git", [
    "clone",
    "--depth",
    "1",
    "--branch",
    branchName,
    "--single-branch",
    cloneUrl,
    workspacePath
  ], {
    cwd: workspaceRoot
  });
  await mkdir(workspacePath, { recursive: true });

  return writeWorkspaceMetadata({
    workflow,
    workspacePath,
    workspaceName,
    refreshed: false
  });
}
