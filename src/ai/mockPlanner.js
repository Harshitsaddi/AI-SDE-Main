function riskFromIssue(issue) {
  const text = `${issue.title}\n${issue.body}`.toLowerCase();

  if (text.includes("security") || text.includes("auth") || text.includes("payment")) {
    return "high";
  }

  if (text.includes("bug") || text.includes("error") || text.includes("crash")) {
    return "medium";
  }

  return "low";
}

export async function generateMockPlan({ planningInput, repositoryContext }) {
  const { issue, repository } = planningInput;
  const risk = riskFromIssue(issue);

  return {
    provider: "mock",
    status: "plan_generated",
    issueSummary: issue.body
      ? `${issue.title}\n\n${issue.body}`.slice(0, 1200)
      : issue.title,
    repositoryContext,
    proposedBranchName: `ai/issue-${issue.number || issue.id || "unknown"}`,
    risk,
    affectedAreas: repositoryContext.candidateFiles.length
      ? repositoryContext.candidateFiles
      : ["To be determined after repository checkout"],
    implementationPlan: [
      "Clone the repository at the current default branch.",
      "Inspect files related to the issue title, body, labels, and failing behavior.",
      "Make the smallest code change that resolves the issue.",
      "Add or update focused tests for the changed behavior.",
      "Run the repository validation commands before opening a pull request."
    ],
    validationCommands: [
      "npm test",
      "npm run lint",
      "npm run typecheck"
    ],
    humanReviewChecklist: [
      "Confirm the plan targets the intended issue.",
      "Confirm the proposed branch name is acceptable.",
      "Confirm validation commands match the repository stack.",
      "Approve before allowing code changes."
    ]
  };
}
