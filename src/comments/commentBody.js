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

export function buildClarificationComment(workflow) {
  const issue = workflow.planningInput.issue;
  const questions = workflow.clarification?.questions || workflow.plan?.clarificationQuestions || [];
  const context = workflow.clarification?.context || workflow.plan?.clarificationContext || "";

  return [
    `## Clarification needed for #${issue.number}: ${issue.title}`,
    "",
    context || "I need a bit more detail before I can create a safe implementation plan.",
    "",
    "### Blocking questions",
    listItems(questions),
    "",
    "Reply with any additional context in a normal issue comment. You can answer everything in one comment; exact formatting is not required.",
    "",
    "Commands still work: `/ai approve` and `/ai reject` will not be treated as clarification."
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
