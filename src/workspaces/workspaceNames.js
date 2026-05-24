import crypto from "node:crypto";

export function workspaceNameForWorkflow(workflow) {
  const repo = workflow.planningInput.repository.fullName || "unknown-repo";
  const issue = workflow.planningInput.issue.number || workflow.planningInput.issue.id || "unknown";
  const hash = crypto.createHash("sha256").update(workflow.id).digest("hex").slice(0, 10);
  const readable = `${repo}-issue-${issue}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${readable}-${hash}`;
}
