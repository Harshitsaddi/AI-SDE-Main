import { createMockBranch } from "./mockBranchService.js";
import { createGitHubBranch } from "./githubBranchService.js";

export async function createBranch({ config, workflow, fetchImpl }) {
  if (config.branchProvider === "mock") {
    return createMockBranch({ workflow });
  }

  if (config.branchProvider === "github_token") {
    return createGitHubBranch({ config, workflow, fetchImpl });
  }

  throw new Error(`Unsupported BRANCH_PROVIDER: ${config.branchProvider}`);
}
