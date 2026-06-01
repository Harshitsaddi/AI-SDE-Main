import { createGitHubClientFromConfig } from "../github/auth.js";
import { splitRepositoryFullName } from "../github/repositories.js";
import { runCommand } from "../system/commandRunner.js";
import { buildPullRequestBody, buildPullRequestTitle } from "./pullRequestBody.js";

async function pushWorkspaceBranch({ workflow, commandRunner }) {
  if (!workflow.workspace?.repositoryCheckedOut || !workflow.workspace?.path || !workflow.branch?.branchName) {
    return null;
  }

  const result = await commandRunner("git", [
    "push",
    "origin",
    `HEAD:refs/heads/${workflow.branch.branchName}`
  ], {
    cwd: workflow.workspace.path
  });

  return {
    command: "git",
    args: result.args,
    exitCode: result.exitCode
  };
}

export async function createGitHubPullRequest({
  config,
  workflow,
  fetchImpl,
  commandRunner = runCommand
}) {
  const repository = workflow.planningInput.repository;
  const { owner, repo } = splitRepositoryFullName(repository.fullName);
  const client = await createGitHubClientFromConfig({ config, fetchImpl });
  const push = await pushWorkspaceBranch({ workflow, commandRunner });
  const head = `${owner}:${workflow.branch.branchName}`;
  const existingPullRequests = await client.listPullRequests({
    owner,
    repo,
    head,
    base: repository.defaultBranch,
    state: "open"
  });
  const existingPullRequest = existingPullRequests?.[0];

  if (existingPullRequest) {
    return {
      provider: "github_token",
      created: false,
      existing: true,
      draft: Boolean(existingPullRequest.draft),
      title: existingPullRequest.title,
      body: existingPullRequest.body,
      head: workflow.branch.branchName,
      base: repository.defaultBranch,
      url: existingPullRequest.html_url,
      number: existingPullRequest.number,
      push
    };
  }

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
    number: pullRequest.number,
    push
  };
}
