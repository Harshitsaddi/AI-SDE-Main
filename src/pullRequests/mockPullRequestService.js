import { buildPullRequestBody, buildPullRequestTitle } from "./pullRequestBody.js";

export async function createMockPullRequest({ config, workflow }) {
  const repository = workflow.planningInput.repository;
  const title = buildPullRequestTitle(workflow);
  const body = buildPullRequestBody(workflow);

  return {
    provider: "mock",
    created: false,
    draft: config.prDraft,
    title,
    body,
    head: workflow.branch.branchName,
    base: repository.defaultBranch,
    url: repository.htmlUrl
      ? `${repository.htmlUrl}/pull/new/${encodeURIComponent(workflow.branch.branchName)}`
      : "",
    number: null
  };
}
