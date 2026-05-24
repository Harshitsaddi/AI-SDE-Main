function findingSeverityFor(workflow) {
  if (workflow.validation?.passed === false) {
    return "high";
  }

  if (workflow.diff?.truncated) {
    return "medium";
  }

  if (!workflow.diff?.changedFiles?.length) {
    return "info";
  }

  return "low";
}

export async function runMockReview({ workflow }) {
  const severity = findingSeverityFor(workflow);
  const findings = [];

  if (workflow.validation?.passed === false) {
    findings.push({
      severity: "high",
      title: "Validation failed",
      body: "One or more validation commands failed. Human review should inspect the validation output before merging.",
      path: null
    });
  }

  if (workflow.diff?.truncated) {
    findings.push({
      severity: "medium",
      title: "Diff was truncated",
      body: "The captured diff exceeded the configured byte limit, so review coverage is incomplete.",
      path: null
    });
  }

  if (!workflow.diff?.changedFiles?.length) {
    findings.push({
      severity: "info",
      title: "No changed files detected",
      body: "The implementation stage did not produce code changes.",
      path: null
    });
  }

  return {
    provider: "mock",
    passed: !findings.some((finding) => finding.severity === "high"),
    severity,
    findings,
    summary: findings.length
      ? `Mock review completed with ${findings.length} finding(s).`
      : "Mock review completed with no findings."
  };
}
