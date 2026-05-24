import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createWorkflowStore } from "../src/workflows/fileStore.js";

function planningInput() {
  return {
    repository: {
      fullName: "acme/app"
    },
    issue: {
      id: 10,
      number: 42
    }
  };
}

test("persists workflows to a file and reloads them", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-sde-store-"));
  const workflowStorePath = path.join(root, "workflows.json");
  const config = {
    workflowStoreProvider: "file",
    workflowStorePath
  };

  const store = createWorkflowStore(config);
  const workflow = store.createFromPlan({
    planningInput: planningInput(),
    plan: {
      provider: "mock"
    }
  });
  store.approve(workflow.id, {
    reviewer: "sam"
  });

  const reloaded = createWorkflowStore(config);
  const loadedWorkflow = reloaded.get(workflow.id);

  assert.equal(loadedWorkflow.status, "approved");
  assert.equal(loadedWorkflow.approvals[0].reviewer, "sam");
});

test("creates memory workflow store when configured", () => {
  const store = createWorkflowStore({
    workflowStoreProvider: "memory"
  });

  store.createFromPlan({
    planningInput: planningInput(),
    plan: {
      provider: "mock"
    }
  });

  assert.equal(store.list().length, 1);
});

test("rejects unsupported workflow store providers", () => {
  assert.throws(
    () => createWorkflowStore({
      workflowStoreProvider: "sqlite"
    }),
    /Unsupported WORKFLOW_STORE_PROVIDER/
  );
});
