export function candidateFilesFromWorkflow(workflow) {
  const searchMatchFiles = workflow.repositoryInspection?.searchMatches?.map((match) => match.path) || [];
  const planFiles = workflow.plan.affectedAreas || [];

  return [...new Set([...searchMatchFiles, ...planFiles])]
    .filter((file) => file && file !== "To be determined after repository checkout")
    .slice(0, 20);
}

export function validationCommandsFromWorkflow(workflow) {
  const inspectionCommands = workflow.repositoryInspection?.validationCommands || [];

  if (inspectionCommands.length) {
    return inspectionCommands;
  }

  return workflow.plan.validationCommands || [];
}

export function implementationPromptForWorkflow(workflow) {
  const issue = workflow.planningInput?.issue || {};
  const repository = workflow.planningInput?.repository || {};
  const candidateFiles = candidateFilesFromWorkflow(workflow);
  const validationCommands = validationCommandsFromWorkflow(workflow);

  return [
    "# AI SDE Implementation Task",
    "",
    `Workflow: ${workflow.id}`,
    `Repository: ${repository.fullName || "unknown"}`,
    `Issue: #${issue.number || ""} ${issue.title || ""}`.trim(),
    issue.url ? `Issue URL: ${issue.url}` : "",
    "",
    "## Issue Body",
    issue.body || "No issue body provided.",
    "",
    "## Plan",
    ...(workflow.plan?.implementationPlan || []).map((item) => `- ${item}`),
    "",
    "## Candidate Files",
    ...(candidateFiles.length ? candidateFiles.map((file) => `- ${file}`) : ["- None detected"]),
    "",
    "## Validation Commands",
    ...(validationCommands.length ? validationCommands.map((command) => `- ${command}`) : ["- None detected"]),
    "",
    "Make the smallest safe code change that resolves the issue. Add or update focused tests when appropriate."
  ].filter((line) => line !== "").join("\n");
}
