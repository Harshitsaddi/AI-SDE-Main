export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 3000),
    githubWebhookSecret: env.GITHUB_WEBHOOK_SECRET || "",
    aiProvider: env.AI_PROVIDER || "mock",
    branchProvider: env.BRANCH_PROVIDER || "mock",
    githubToken: env.GITHUB_TOKEN || "",
    githubApiBaseUrl: env.GITHUB_API_BASE_URL || "https://api.github.com",
    workspaceProvider: env.WORKSPACE_PROVIDER || "mock",
    workspaceRoot: env.WORKSPACE_ROOT || "var/workspaces",
    inspectionProvider: env.INSPECTION_PROVIDER || "local",
    inspectionMaxFiles: Number(env.INSPECTION_MAX_FILES || 500),
    implementationProvider: env.IMPLEMENTATION_PROVIDER || "mock",
    validationProvider: env.VALIDATION_PROVIDER || "mock",
    validationCommandTimeoutMs: Number(env.VALIDATION_COMMAND_TIMEOUT_MS || 120000),
    diffProvider: env.DIFF_PROVIDER || "git",
    diffMaxBytes: Number(env.DIFF_MAX_BYTES || 200000),
    reviewProvider: env.REVIEW_PROVIDER || "mock",
    prProvider: env.PR_PROVIDER || "mock",
    prDraft: env.PR_DRAFT !== "false",
    workflowStoreProvider: env.WORKFLOW_STORE_PROVIDER || "file",
    workflowStorePath: env.WORKFLOW_STORE_PATH || "var/data/workflows.json"
  };
}
