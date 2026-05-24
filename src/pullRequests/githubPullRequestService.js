import { createGitHubClient } from "../github/client.js";
import { splitRepositoryFullName } from "../github/repositories.js";
import { buildPullRequestBody, buildPullRequestTitle } from "./pullRequestBody.js";

export async function createGitHubPullRequest({ config, workflow, fetchImpl }) {
  const repository = workflow.planningInput.repository;
  const { owner, repo } = splitRepositoryFullName(repository.fullName);
  const client = createGitHubClient({
    token: config.githubToken,
    apiBaseUrl: config.githubApiBaseUrl,
    fetchImpl
  });

  const pullRequest = await client.createPullRequest({
    owner,
    repo,
    title: buildPullRequestTitle(workflow),
    head: workflow.branch.branchName,
    base: repository.defaultBranch,
    body: buildPullRequestBody(workflow),
    draft: config.prDraft
  });

  return {
    provider: "github_token",
    created: true,
    draft: Boolean(pullRequest.draft),
    title: pullRequest.title,
    body: pullRequest.body,
    head: workflow.branch.branchName,
    base: repository.defaultBranch,
    url: pullRequest.html_url,
    number: pullRequest.number
  };
}
