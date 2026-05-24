import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { prepareMockWorkspace } from "../src/workspaces/mockWorkspaceService.js";
import { workspaceNameForWorkflow } from "../src/workspaces/workspaceNames.js";

function workflow() {
  return {
    id: "acme/app#issue-42",
    branch: {
      branchName: "ai/issue-42",
      baseBranch: "main"
    },
    planningInput: {
      repository: {
        fullName: "acme/app"
      },
      issue: {
        number: 42
      }
    }
  };
}

test("creates a deterministic workspace name for a workflow", () => {
  const name = workspaceNameForWorkflow(workflow());

  assert.match(name, /^acme-app-issue-42-[a-f0-9]{10}$/);
  assert.equal(name, workspaceNameForWorkflow(workflow()));
});

test("prepares a mock workspace with metadata", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "ai-sde-workspaces-"));
  const workspace = await prepareMockWorkspace({
    config: {
      workspaceRoot
    },
    workflow: workflow()
  });

  const metadata = JSON.parse(await readFile(workspace.metadataPath, "utf8"));

  assert.equal(workspace.provider, "mock");
  assert.equal(workspace.repositoryCheckedOut, false);
  assert.equal(metadata.workflowId, "acme/app#issue-42");
  assert.equal(metadata.branchName, "ai/issue-42");
});
