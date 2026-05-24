import { createGitHubPullRequest } from "./githubPullRequestService.js";
import { createMockPullRequest } from "./mockPullRequestService.js";

export async function createPullRequest({ config, workflow, fetchImpl }) {
  if (config.prProvider === "mock") {
    return createMockPullRequest({ config, workflow });
  }

  if (config.prProvider === "github_token") {
    return createGitHubPullRequest({ config, workflow, fetchImpl });
  }

  throw new Error(`Unsupported PR_PROVIDER: ${config.prProvider}`);
}
