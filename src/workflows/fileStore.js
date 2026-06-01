import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createAuditLogger } from "../audit/auditLog.js";
import { createSqliteWorkflowStore } from "./sqliteStore.js";
import { WorkflowStore } from "./store.js";

function readWorkflows(filePath) {
  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, "utf8");
  if (!content.trim()) {
    return [];
  }

  const data = JSON.parse(content);
  return Array.isArray(data.workflows) ? data.workflows : [];
}

function writeWorkflows(filePath, workflows) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify({ workflows }, null, 2)}\n`, "utf8");
}

export function createWorkflowStore(config) {
  const onAudit = createAuditLogger(config);

  if (config.workflowStoreProvider === "memory") {
    return new WorkflowStore({ onAudit });
  }

  if (config.workflowStoreProvider === "file") {
    const filePath = path.resolve(config.workflowStorePath);
    return new WorkflowStore({
      workflows: readWorkflows(filePath),
      onChange: (workflows) => writeWorkflows(filePath, workflows),
      onAudit
    });
  }

  if (config.workflowStoreProvider === "sqlite") {
    return createSqliteWorkflowStore({
      workflowStorePath: config.workflowStorePath,
      onAudit
    });
  }

  throw new Error(`Unsupported WORKFLOW_STORE_PROVIDER: ${config.workflowStoreProvider}`);
}
