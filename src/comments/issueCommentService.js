import { buildPlanComment, buildStatusComment } from "./commentBody.js";
import { createGitHubIssueComment } from "./githubIssueCommentService.js";
import { createMockIssueComment } from "./mockIssueCommentService.js";

function commentBodyForKind(kind, workflow) {
  if (kind === "plan") {
    return buildPlanComment(workflow);
  }

  if (kind === "status") {
    return buildStatusComment(workflow);
  }

  throw new Error(`Unsupported issue comment kind: ${kind}`);
}

export async function publishIssueComment({ config, workflow, kind, fetchImpl }) {
  if (config.issueCommentProvider === "none") {
    return {
      provider: "none",
      created: false,
      issueNumber: workflow.planningInput.issue.number,
      body: "",
      url: ""
    };
  }

  const body = commentBodyForKind(kind, workflow);

  if (config.issueCommentProvider === "mock") {
    return createMockIssueComment({ body, workflow });
  }

  if (config.issueCommentProvider === "github_token") {
    return createGitHubIssueComment({ config, workflow, body, fetchImpl });
  }

  throw new Error(`Unsupported ISSUE_COMMENT_PROVIDER: ${config.issueCommentProvider}`);
}
