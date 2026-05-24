export async function buildRepositoryContext(planningInput) {
  const repo = planningInput.repository;

  return {
    repository: repo.fullName,
    defaultBranch: repo.defaultBranch,
    retrievalMode: "metadata_only",
    summary:
      "Repository cloning and code retrieval are not enabled in this MVP slice. The planner is using issue text, labels, and repository metadata.",
    signals: [
      repo.fullName ? `repo:${repo.fullName}` : null,
      repo.defaultBranch ? `default_branch:${repo.defaultBranch}` : null,
      ...planningInput.issue.labels.map((label) => `label:${label}`)
    ].filter(Boolean),
    candidateFiles: []
  };
}
