function listItems(values = []) {
  if (!values.length) {
    return "- None";
  }

  return values.map((value) => `- ${value}`).join("\n");
}

export function buildPlanComment(workflow) {
  const issue = workflow.planningInput.issue;
  const plan = workflow.plan;

  return [
    `## AI implementation plan for #${issue.number}: ${issue.title}`,
    "",
    plan.issueSummary || "No summary provided.",
    "",
    "### Proposed changes",
    listItems(plan.proposedChanges),
    "",
    "### Validation",
    listItems(plan.validationCommands),
    "",
    `Risk: ${plan.risk || "unknown"}`,
    "",
    "Reply with `/ai approve` to start implementation or `/ai reject` to reject this plan."
  ].join("\n");
}

export function buildStatusComment(workflow) {
  const lines = [
    `## AI workflow status: ${workflow.status}`,
    "",
    `Workflow: \`${workflow.id}\``
  ];

  if (workflow.pullRequest?.url) {
    lines.push("", `Pull request: ${workflow.pullRequest.url}`);
  }

  const latestEvent = workflow.events?.at(-1);
  if (latestEvent?.message) {
    lines.push("", `Latest event: ${latestEvent.message}`);
  }

  return lines.join("\n");
}
