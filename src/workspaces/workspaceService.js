import { prepareGitWorkspace } from "./gitWorkspaceService.js";
import { prepareMockWorkspace } from "./mockWorkspaceService.js";

export async function prepareWorkspace({ config, workflow, commandRunner }) {
  if (config.workspaceProvider === "mock") {
    return prepareMockWorkspace({ config, workflow });
  }

  if (config.workspaceProvider === "git") {
    return prepareGitWorkspace({ config, workflow, commandRunner });
  }

  throw new Error(`Unsupported WORKSPACE_PROVIDER: ${config.workspaceProvider}`);
}
