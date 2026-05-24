import { sanitizeBranchName } from "./branchNames.js";

export async function createMockBranch({ workflow }) {
  const branchName = sanitizeBranchName(workflow.plan.proposedBranchName);

  return {
    provider: "mock",
    branchName,
    baseBranch: workflow.planningInput.repository.defaultBranch,
    repository: workflow.planningInput.repository.fullName,
    url: workflow.planningInput.repository.htmlUrl
      ? `${workflow.planningInput.repository.htmlUrl}/tree/${encodeURIComponent(branchName)}`
      : "",
    created: true
  };
}
