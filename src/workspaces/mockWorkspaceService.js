import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { workspaceNameForWorkflow } from "./workspaceNames.js";

export async function prepareMockWorkspace({ config, workflow }) {
  const workspaceName = workspaceNameForWorkflow(workflow);
  const workspacePath = path.resolve(config.workspaceRoot, workspaceName);
  const metadataPath = path.join(workspacePath, "metadata.json");
  const metadata = {
    workflowId: workflow.id,
    repository: workflow.planningInput.repository.fullName,
    branchName: workflow.branch.branchName,
    baseBranch: workflow.branch.baseBranch,
    provider: "mock",
    preparedAt: new Date().toISOString(),
    note: "Mock workspace prepared. Repository checkout will be added in the next provider."
  };

  await mkdir(workspacePath, { recursive: true });
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  return {
    provider: "mock",
    workspaceName,
    path: workspacePath,
    metadataPath,
    repositoryCheckedOut: false
  };
}
