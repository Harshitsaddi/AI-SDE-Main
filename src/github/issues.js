const PLAN_TRIGGER_ACTIONS = new Set(["opened"]);

export function shouldPlanIssue(eventName, payload) {
  return eventName === "issues" && PLAN_TRIGGER_ACTIONS.has(payload.action);
}

export function shouldHandleIssueComment(eventName, payload) {
  return eventName === "issue_comment" && payload.action === "created";
}

export function issueCommentCommand(payload) {
  const body = (payload.comment?.body || "").trim().toLowerCase();

  if (body === "/ai approve") {
    return "approve";
  }

  if (body === "/ai reject") {
    return "reject";
  }

  return null;
}

export function isAiSdeGeneratedComment(payload) {
  const body = (payload.comment?.body || "").trim();

  return [
    "## AI implementation plan",
    "## AI workflow status:",
    "## Clarification needed"
  ].some((prefix) => body.startsWith(prefix));
}

export function issueEventToPlanningInput(payload) {
  const issue = payload.issue || {};
  const repository = payload.repository || {};
  const owner = repository.owner || {};

  return {
    source: "github",
    action: payload.action,
    issue: {
      id: issue.id,
      number: issue.number,
      title: issue.title || "",
      body: issue.body || "",
      url: issue.html_url || issue.url || "",
      labels: Array.isArray(issue.labels) ? issue.labels.map((label) => label.name).filter(Boolean) : [],
      author: issue.user?.login || ""
    },
    repository: {
      id: repository.id,
      name: repository.name || "",
      fullName: repository.full_name || "",
      owner: owner.login || repository.owner?.name || "",
      defaultBranch: repository.default_branch || "main",
      cloneUrl: repository.clone_url || "",
      htmlUrl: repository.html_url || ""
    }
  };
}

export function issueCommentEventToWorkflowId(payload) {
  const repository = payload.repository || {};
  const issue = payload.issue || {};
  const fullName = repository.full_name || "unknown-repo";
  const issueNumber = issue.number || issue.id || "unknown";

  return `${fullName}#issue-${issueNumber}`;
}
