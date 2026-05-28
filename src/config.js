function parseValidationCommandOverrides(value) {
  if (!value) {
    return {};
  }

  const parsed = JSON.parse(value);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("VALIDATION_COMMAND_OVERRIDES must be a JSON object");
  }

  for (const [repository, commands] of Object.entries(parsed)) {
    if (!repository || !Array.isArray(commands) || commands.some((command) => typeof command !== "string")) {
      throw new Error("VALIDATION_COMMAND_OVERRIDES entries must be arrays of command strings");
    }
  }

  return parsed;
}

function parseStringArray(value, name) {
  if (!value) {
    return [];
  }

  const parsed = JSON.parse(value);

  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error(`${name} must be a JSON array of strings`);
  }

  return parsed;
}

function parseRepositoryConfig(value) {
  if (!value) {
    return {};
  }

  const parsed = JSON.parse(value);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("REPOSITORY_CONFIG must be a JSON object");
  }

  for (const [repository, overrides] of Object.entries(parsed)) {
    if (!repository || !overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
      throw new Error("REPOSITORY_CONFIG entries must be objects keyed by owner/repo");
    }
  }

  return parsed;
}

export function configForRepository(config, repositoryFullName) {
  const overrides = config.repositoryConfig?.[repositoryFullName] || {};
  const merged = {
    ...config,
    ...overrides
  };

  if (Array.isArray(overrides.validationCommands)) {
    merged.validationCommandOverrides = {
      ...(config.validationCommandOverrides || {}),
      [repositoryFullName]: overrides.validationCommands
    };
  }

  return merged;
}

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 3000),
    githubWebhookSecret: env.GITHUB_WEBHOOK_SECRET || "",
    aiProvider: env.AI_PROVIDER || "mock",
    aiModel: env.AI_MODEL || "",
    aiApiKey: env.AI_API_KEY || "",
    openaiApiKey: env.OPENAI_API_KEY || "",
    anthropicApiKey: env.ANTHROPIC_API_KEY || "",
    geminiApiKey: env.GEMINI_API_KEY || "",
    aiSettingsPath: env.AI_SETTINGS_PATH || "var/data/ai-settings.json",
    aiCommand: env.AI_COMMAND || "",
    aiCommandAllowlist: parseStringArray(env.AI_COMMAND_ALLOWLIST, "AI_COMMAND_ALLOWLIST"),
    aiCommandTimeoutMs: Number(env.AI_COMMAND_TIMEOUT_MS || 120000),
    aiCommandWorkDir: env.AI_COMMAND_WORK_DIR || "var/ai",
    branchProvider: env.BRANCH_PROVIDER || "mock",
    githubAuthProvider: env.GITHUB_AUTH_PROVIDER || "token",
    githubToken: env.GITHUB_TOKEN || "",
    githubAppId: env.GITHUB_APP_ID || "",
    githubAppPrivateKey: (env.GITHUB_APP_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    githubAppInstallationId: env.GITHUB_APP_INSTALLATION_ID || "",
    githubApiBaseUrl: env.GITHUB_API_BASE_URL || "https://api.github.com",
    workspaceProvider: env.WORKSPACE_PROVIDER || "mock",
    workspaceRoot: env.WORKSPACE_ROOT || "var/workspaces",
    inspectionProvider: env.INSPECTION_PROVIDER || "local",
    inspectionMaxFiles: Number(env.INSPECTION_MAX_FILES || 500),
    implementationProvider: env.IMPLEMENTATION_PROVIDER || "mock",
    implementationCommand: env.IMPLEMENTATION_COMMAND || "",
    implementationCommandTimeoutMs: Number(env.IMPLEMENTATION_COMMAND_TIMEOUT_MS || 600000),
    implementationCommandAllowlist: parseStringArray(
      env.IMPLEMENTATION_COMMAND_ALLOWLIST,
      "IMPLEMENTATION_COMMAND_ALLOWLIST"
    ),
    implementationContainerImage: env.IMPLEMENTATION_CONTAINER_IMAGE || "",
    implementationContainerWorkdir: env.IMPLEMENTATION_CONTAINER_WORKDIR || "/workspace",
    implementationContainerExtraArgs: parseStringArray(
      env.IMPLEMENTATION_CONTAINER_EXTRA_ARGS,
      "IMPLEMENTATION_CONTAINER_EXTRA_ARGS"
    ),
    validationProvider: env.VALIDATION_PROVIDER || "mock",
    validationCommandTimeoutMs: Number(env.VALIDATION_COMMAND_TIMEOUT_MS || 120000),
    validationCommandAllowlist: parseStringArray(
      env.VALIDATION_COMMAND_ALLOWLIST,
      "VALIDATION_COMMAND_ALLOWLIST"
    ),
    validationContainerImage: env.VALIDATION_CONTAINER_IMAGE || "",
    validationContainerWorkdir: env.VALIDATION_CONTAINER_WORKDIR || "/workspace",
    validationContainerExtraArgs: parseStringArray(
      env.VALIDATION_CONTAINER_EXTRA_ARGS,
      "VALIDATION_CONTAINER_EXTRA_ARGS"
    ),
    validationCommandOverrides: parseValidationCommandOverrides(env.VALIDATION_COMMAND_OVERRIDES),
    secretRedactionPatterns: parseStringArray(
      env.SECRET_REDACTION_PATTERNS,
      "SECRET_REDACTION_PATTERNS"
    ),
    repositoryConfig: parseRepositoryConfig(env.REPOSITORY_CONFIG),
    diffProvider: env.DIFF_PROVIDER || "git",
    diffMaxBytes: Number(env.DIFF_MAX_BYTES || 200000),
    reviewProvider: env.REVIEW_PROVIDER || "mock",
    prProvider: env.PR_PROVIDER || "mock",
    prDraft: env.PR_DRAFT !== "false",
    issueCommentProvider: env.ISSUE_COMMENT_PROVIDER || "none",
    auditLogProvider: env.AUDIT_LOG_PROVIDER || "none",
    auditLogPath: env.AUDIT_LOG_PATH || "var/audit/workflow-audit.jsonl",
    workflowStoreProvider: env.WORKFLOW_STORE_PROVIDER || "file",
    workflowStorePath: env.WORKFLOW_STORE_PATH || "var/data/workflows.json"
  };
}
