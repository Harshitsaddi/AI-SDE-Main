import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { WorkflowStore } from "./store.js";

function repositoryFor(workflow) {
  return workflow.planningInput?.repository?.fullName || "";
}

function issueNumberFor(workflow) {
  return workflow.planningInput?.issue?.number || null;
}

function createSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      repository TEXT NOT NULL,
      issue_number INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      workflow_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_workflows_updated_at
      ON workflows(updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_workflows_repository_issue
      ON workflows(repository, issue_number);

    CREATE INDEX IF NOT EXISTS idx_workflows_status
      ON workflows(status);
  `);
}

function loadWorkflows(database) {
  const statement = database.prepare(`
    SELECT workflow_json
    FROM workflows
    ORDER BY updated_at DESC
  `);

  return statement.all().map((row) => JSON.parse(row.workflow_json));
}

export function createSqliteWorkflowStore({ workflowStorePath, onAudit }) {
  const filePath = path.resolve(workflowStorePath);
  mkdirSync(path.dirname(filePath), { recursive: true });

  const database = new DatabaseSync(filePath);
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA busy_timeout = 5000;");
  createSchema(database);

  const upsertWorkflow = database.prepare(`
    INSERT INTO workflows (
      id,
      status,
      repository,
      issue_number,
      created_at,
      updated_at,
      workflow_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      repository = excluded.repository,
      issue_number = excluded.issue_number,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      workflow_json = excluded.workflow_json
  `);

  function persistWorkflow(workflow) {
    if (!workflow) {
      return;
    }

    upsertWorkflow.run(
      workflow.id,
      workflow.status,
      repositoryFor(workflow),
      issueNumberFor(workflow),
      workflow.createdAt,
      workflow.updatedAt,
      JSON.stringify(workflow)
    );
  }

  return new WorkflowStore({
    workflows: loadWorkflows(database),
    onChange: (_workflows, workflow) => persistWorkflow(workflow),
    onAudit
  });
}
