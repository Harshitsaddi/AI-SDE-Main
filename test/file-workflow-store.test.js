import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
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

test("persists workflows to sqlite and reloads them", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-sde-sqlite-store-"));
  const workflowStorePath = path.join(root, "workflows.sqlite");
  const config = {
    workflowStoreProvider: "sqlite",
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

  const database = new DatabaseSync(workflowStorePath, { readOnly: true });
  const row = database.prepare(`
    SELECT id, status, repository, issue_number
    FROM workflows
    WHERE id = ?
  `).get(workflow.id);
  database.close();

  const reloaded = createWorkflowStore(config);
  const loadedWorkflow = reloaded.get(workflow.id);

  assert.equal(row.status, "approved");
  assert.equal(row.repository, "acme/app");
  assert.equal(row.issue_number, 42);
  assert.equal(loadedWorkflow.status, "approved");
  assert.equal(loadedWorkflow.approvals[0].reviewer, "sam");
});

test("creates sqlite workflow indexes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-sde-sqlite-indexes-"));
  const workflowStorePath = path.join(root, "workflows.sqlite");
  createWorkflowStore({
    workflowStoreProvider: "sqlite",
    workflowStorePath
  });

  const database = new DatabaseSync(workflowStorePath, { readOnly: true });
  const indexes = database.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'index'
    ORDER BY name
  `).all().map((row) => row.name);
  database.close();

  assert.ok(indexes.includes("idx_workflows_repository_issue"));
  assert.ok(indexes.includes("idx_workflows_status"));
  assert.ok(indexes.includes("idx_workflows_updated_at"));
});

test("writes append-only audit log entries when configured", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-sde-audit-"));
  const auditLogPath = path.join(root, "audit.jsonl");
  const store = createWorkflowStore({
    workflowStoreProvider: "memory",
    auditLogProvider: "file",
    auditLogPath
  });

  const workflow = store.createFromPlan({
    planningInput: planningInput(),
    plan: {
      provider: "mock"
    }
  });
  store.approve(workflow.id, {
    reviewer: "sam"
  });

  const entries = (await readFile(auditLogPath, "utf8"))
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));

  assert.equal(entries.length, 2);
  assert.equal(entries[0].workflowId, "acme/app#issue-42");
  assert.equal(entries[0].event.type, "plan_generated");
  assert.equal(entries[1].status, "approved");
  assert.equal(entries[1].event.type, "plan_approved");
});

test("rejects unsupported workflow store providers", () => {
  assert.throws(
    () => createWorkflowStore({
      workflowStoreProvider: "postgres"
    }),
    /Unsupported WORKFLOW_STORE_PROVIDER/
  );
});
