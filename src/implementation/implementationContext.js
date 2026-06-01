export function candidateFilesFromWorkflow(workflow) {
  const searchMatchFiles = workflow.repositoryInspection?.searchMatches?.map((match) => match.path) || [];
  const planFiles = workflow.plan.affectedAreas || [];

  return [...new Set([...searchMatchFiles, ...planFiles])]
    .filter((file) => {
      if (!file || file === "To be determined after repository checkout") {
        return false;
      }

      if (/^unknown\b/i.test(file) || /\bno issue body provided\b/i.test(file)) {
        return false;
      }

      return /[/.\\]/.test(file);
    })
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
  const repositoryInstructions = workflow.repositoryInspection?.repositoryInstructions || [];

  return [
    "# AI SDE Implementation Task",
    "",
    `Workflow: ${workflow.id}`,
    `Repository: ${repository.fullName || "unknown"}`,
    `Issue: #${issue.number || ""} ${issue.title || ""}`.trim(),
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
    "## Repository Instructions",
    ...(repositoryInstructions.length
      ? repositoryInstructions.flatMap((file) => [
        `### ${file.path}`,
        file.content
      ])
      : ["None detected."]),
    "",
    "## Validation Commands",
    ...(validationCommands.length ? validationCommands.map((command) => `- ${command}`) : ["- None detected"]),
    "",
    "Use only the issue details and repository files available in this workspace. Do not browse or scrape the GitHub issue URL.",
    "If the issue is too ambiguous to safely change code, do not edit files; explain the clarification needed in your output.",
    "Make the smallest safe code change that resolves the issue. Add or update focused tests when appropriate."
  ].filter((line) => line !== "").join("\n");
}
