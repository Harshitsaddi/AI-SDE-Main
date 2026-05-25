import { createGitHubClientFromConfig } from "../github/auth.js";
import { splitRepositoryFullName } from "../github/repositories.js";

export async function createGitHubIssueComment({ config, workflow, body, fetchImpl }) {
  const repository = workflow.planningInput.repository;
  const { owner, repo } = splitRepositoryFullName(repository.fullName);
  const client = await createGitHubClientFromConfig({ config, fetchImpl });

  const comment = await client.createIssueComment({
    owner,
    repo,
    issueNumber: workflow.planningInput.issue.number,
    body
  });

  return {
    provider: "github_token",
    created: true,
    issueNumber: workflow.planningInput.issue.number,
    body: comment.body,
    url: comment.html_url,
    id: comment.id
  };
}
