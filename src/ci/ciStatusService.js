import { createGitHubClientFromConfig } from "../github/auth.js";
import { GitHubApiError } from "../github/client.js";
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
  let body;

  try {
    body = await client.listCheckRunsForRef({
      owner,
      repo,
      ref: workflow.branch.branchName
    });
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 403) {
      return {
        provider: "github",
        passed: false,
        status: "unavailable",
        total: 0,
        passedCount: 0,
        failedCount: 0,
        pendingCount: 0,
        checkRuns: [],
        error: {
          status: error.status,
          message: error.body?.message || error.message,
          rateLimit: error.rateLimit,
          retryAfter: error.retryAfter
        },
        summary: ciPermissionSummary(error)
      };
    }

    throw error;
  }
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

function ciPermissionSummary(error) {
  const message = error.body?.message || error.message;

  if (error.rateLimit?.remaining === 0) {
    return `GitHub checks could not be read because the API rate limit is exhausted. Retry after reset time ${error.rateLimit.resetEpochSeconds || "unknown"}.`;
  }

  return `GitHub checks could not be read: ${message}. Add read-only Checks permission to the GitHub token/app, or set CI_PROVIDER=none to skip CI collection.`;
}
