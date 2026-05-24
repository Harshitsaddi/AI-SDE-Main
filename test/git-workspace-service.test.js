import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { prepareGitWorkspace } from "../src/workspaces/gitWorkspaceService.js";
import { workspaceNameForWorkflow } from "../src/workspaces/workspaceNames.js";

function workflow(overrides = {}) {
  return {
    id: "acme/app#issue-42",
    branch: {
      branchName: "ai/issue-42",
      baseBranch: "main"
    },
    planningInput: {
      repository: {
        fullName: "acme/app",
        cloneUrl: "https://github.com/acme/app.git",
        ...overrides.repository
      },
      issue: {
        number: 42
      }
    }
  };
}

test("clones a fresh git workspace for the generated branch", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "ai-sde-git-workspaces-"));
  const calls = [];
  const commandRunner = async (command, args, options) => {
    calls.push({ command, args, options });
    return { command, args, options, exitCode: 0, stdout: "", stderr: "" };
  };

  const workspace = await prepareGitWorkspace({
    config: {
      workspaceRoot
    },
    workflow: workflow(),
    commandRunner
  });

  assert.equal(workspace.provider, "git");
  assert.equal(workspace.repositoryCheckedOut, true);
  assert.equal(workspace.refreshed, false);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args.slice(0, 6), [
    "clone",
    "--depth",
    "1",
    "--branch",
    "ai/issue-42",
    "--single-branch"
  ]);

  const metadata = JSON.parse(await readFile(workspace.metadataPath, "utf8"));
  assert.equal(metadata.repository, "acme/app");
  assert.equal(metadata.branchName, "ai/issue-42");
});

test("refreshes an existing git workspace", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "ai-sde-git-workspaces-"));
  const currentWorkflow = workflow();
  const workspacePath = path.join(workspaceRoot, workspaceNameForWorkflow(currentWorkflow));
  await mkdir(path.join(workspacePath, ".git"), { recursive: true });

  const calls = [];
  const commandRunner = async (command, args, options) => {
    calls.push({ command, args, options });
    return { command, args, options, exitCode: 0, stdout: "", stderr: "" };
  };

  const workspace = await prepareGitWorkspace({
    config: {
      workspaceRoot
    },
    workflow: currentWorkflow,
    commandRunner
  });

  assert.equal(workspace.refreshed, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].args, ["fetch", "origin", "ai/issue-42", "--depth", "1"]);
  assert.deepEqual(calls[1].args, ["checkout", "-B", "ai/issue-42", "FETCH_HEAD"]);
});

test("requires a clone URL for git workspaces", async () => {
  await assert.rejects(
    prepareGitWorkspace({
      config: {
        workspaceRoot: await mkdtemp(path.join(os.tmpdir(), "ai-sde-git-workspaces-"))
      },
      workflow: workflow({ repository: { cloneUrl: "" } }),
      commandRunner: async () => ({ exitCode: 0, stdout: "", stderr: "" })
    }),
    /Repository clone URL is required/
  );
});
