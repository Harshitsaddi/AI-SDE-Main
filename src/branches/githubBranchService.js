import { createGitHubClient, GitHubApiError } from "../github/client.js";
import { splitRepositoryFullName } from "../github/repositories.js";
import { sanitizeBranchName } from "./branchNames.js";

export async function createGitHubBranch({ config, workflow, fetchImpl }) {
  const repository = workflow.planningInput.repository;
  const { owner, repo } = splitRepositoryFullName(repository.fullName);
  const branchName = sanitizeBranchName(workflow.plan.proposedBranchName);
  const baseBranch = repository.defaultBranch;
  const client = createGitHubClient({
    token: config.githubToken,
    apiBaseUrl: config.githubApiBaseUrl,
    fetchImpl
  });

  const baseRef = await client.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`
  });

  const sha = baseRef?.object?.sha;
  if (!sha) {
    throw new Error(`Could not resolve SHA for base branch ${baseBranch}`);
  }

  try {
    await client.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha
    });
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 422) {
      return {
        provider: "github_token",
        branchName,
        baseBranch,
        repository: repository.fullName,
        url: `${repository.htmlUrl}/tree/${encodeURIComponent(branchName)}`,
        created: false,
        alreadyExists: true
      };
    }

    throw error;
  }

  return {
    provider: "github_token",
    branchName,
    baseBranch,
    repository: repository.fullName,
    url: `${repository.htmlUrl}/tree/${encodeURIComponent(branchName)}`,
    created: true
  };
}
