import { createGitHubClientFromConfig } from "../github/auth.js";
import { splitRepositoryFullName } from "../github/repositories.js";

function normalizeCheckRun(run) {
  return {
    name: run.name || "",
    status: run.status || "",
    conclusion: run.conclusion || null,
    url: run.html_url || run.details_url || ""
  };
}

function passedConclusion(conclusion) {
  return ["success", "neutral", "skipped"].includes(conclusion);
}

export async function collectCiStatus({ config, workflow, fetchImpl }) {
  if (config.ciProvider === "none") {
    return null;
  }

  if (config.ciProvider !== "github") {
    throw new Error(`Unsupported CI_PROVIDER: ${config.ciProvider}`);
  }

  if (!workflow.branch?.branchName) {
    throw new Error("Workflow branch is required for GitHub CI status collection");
  }

  const repository = workflow.planningInput.repository;
  const { owner, repo } = splitRepositoryFullName(repository.fullName);
  const client = await createGitHubClientFromConfig({ config, fetchImpl });
  const body = await client.listCheckRunsForRef({
    owner,
    repo,
    ref: workflow.branch.branchName
  });
  const runs = (body.check_runs || []).map(normalizeCheckRun);
  const completed = runs.filter((run) => run.status === "completed");
  const failed = completed.filter((run) => !passedConclusion(run.conclusion));
  const pending = runs.filter((run) => run.status !== "completed");
  const passed = runs.length > 0 && failed.length === 0 && pending.length === 0;

  return {
    provider: "github",
    passed,
    status: pending.length ? "pending" : failed.length ? "failed" : runs.length ? "passed" : "missing",
    total: runs.length,
    passedCount: completed.filter((run) => passedConclusion(run.conclusion)).length,
    failedCount: failed.length,
    pendingCount: pending.length,
    checkRuns: runs,
    summary: runs.length
      ? `${runs.length} GitHub check run(s): ${failed.length} failed, ${pending.length} pending.`
      : "No GitHub check runs found for the workflow branch."
  };
}
