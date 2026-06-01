function check(status, name, message, details = {}) {
  return {
    name,
    status,
    message,
    details
  };
}

function hasValue(value) {
  return Boolean(String(value || "").trim());
}

function githubAuthReady(config) {
  if (config.githubAuthProvider === "app") {
    return hasValue(config.githubAppId)
      && hasValue(config.githubAppPrivateKey)
      && hasValue(config.githubAppInstallationId);
  }

  return hasValue(config.githubToken);
}

function githubProviders(config) {
  return [
    config.branchProvider === "github_token" ? "branch" : "",
    config.prProvider === "github_token" ? "pullRequest" : "",
    config.issueCommentProvider === "github_token" ? "issueComment" : ""
  ].filter(Boolean);
}

function aiPlannerCheck(config) {
  if (config.aiProvider === "mock") {
    return check("ok", "AI planner", "Mock planner is ready.");
  }

  if (config.aiProvider === "command") {
    if (!hasValue(config.aiCommand)) {
      return check("fail", "AI planner", "AI_COMMAND is required when AI_PROVIDER=command.");
    }

    return check("ok", "AI planner", "Command planner is configured.", {
      commandAllowlisted: config.aiCommandAllowlist.length > 0
    });
  }

  if (["openai", "anthropic", "gemini"].includes(config.aiProvider)) {
    return hasValue(config.aiApiKey)
      ? check("ok", "AI planner", `${config.aiProvider} planner has an API key.`, { model: config.aiModel })
      : check("fail", "AI planner", `${config.aiProvider} planner needs an API key.`);
  }

  return check("fail", "AI planner", `Unsupported AI_PROVIDER: ${config.aiProvider}`);
}

function implementationCheck(config) {
  if (config.implementationProvider === "mock") {
    return check("warn", "Implementation", "Mock implementation is safe but will not edit code.");
  }

  if (config.implementationProvider === "command") {
    if (!hasValue(config.implementationCommand)) {
      return check("fail", "Implementation", "IMPLEMENTATION_COMMAND is required.");
    }

    return check("ok", "Implementation", "Command implementation is configured.", {
      commandAllowlisted: config.implementationCommandAllowlist.length > 0,
      container: hasValue(config.implementationContainerImage)
    });
  }

  return check("fail", "Implementation", `Unsupported IMPLEMENTATION_PROVIDER: ${config.implementationProvider}`);
}

function validationCheck(config) {
  if (config.validationProvider === "mock") {
    return check("warn", "Validation", "Mock validation will not run tests.");
  }

  if (config.validationProvider === "local") {
    return check(
      config.validationCommandAllowlist.length > 0 ? "ok" : "warn",
      "Validation",
      config.validationCommandAllowlist.length > 0
        ? "Local validation is configured with an allowlist."
        : "Local validation has no command allowlist.",
      { commandAllowlisted: config.validationCommandAllowlist.length > 0 }
    );
  }

  if (config.validationProvider === "container") {
    if (!hasValue(config.validationContainerImage)) {
      return check("fail", "Validation", "VALIDATION_CONTAINER_IMAGE is required.");
    }

    return check("ok", "Validation", "Container validation is configured.", {
      image: config.validationContainerImage,
      commandAllowlisted: config.validationCommandAllowlist.length > 0
    });
  }

  return check("fail", "Validation", `Unsupported VALIDATION_PROVIDER: ${config.validationProvider}`);
}

function ciCheck(config) {
  if (config.ciProvider === "none") {
    return check("warn", "CI status", "CI status collection is disabled.");
  }

  if (config.ciProvider === "github") {
    const providers = githubProviders(config);
    const ready = githubAuthReady({
      ...config,
      prProvider: providers.includes("pullRequest") ? config.prProvider : "github_token"
    });

    return ready
      ? check("ok", "CI status", "GitHub CI status collection is configured.")
      : check("fail", "CI status", "GitHub CI status collection needs GitHub API credentials.");
  }

  return check("fail", "CI status", `Unsupported CI_PROVIDER: ${config.ciProvider}`);
}

function reviewCheck(config) {
  if (config.reviewProvider === "mock") {
    return check("warn", "Review", "Mock review is enabled.");
  }

  if (config.reviewProvider === "model") {
    if (!["openai", "anthropic", "gemini"].includes(config.aiProvider)) {
      return check("fail", "Review", "Model review requires a hosted AI provider.");
    }

    return config.aiApiKey
      ? check("ok", "Review", "Model review is configured.", { provider: config.aiProvider, model: config.aiModel })
      : check("fail", "Review", "Model review needs the selected AI provider API key.");
  }

  return check("fail", "Review", `Unsupported REVIEW_PROVIDER: ${config.reviewProvider}`);
}

export function providerHealth(config) {
  const githubApiUsers = githubProviders(config);
  const checks = [
    check(
      hasValue(config.dashboardToken) ? "ok" : "warn",
      "Dashboard auth",
      hasValue(config.dashboardToken)
        ? "Dashboard API token is enabled."
        : "DASHBOARD_TOKEN is not set; only use this locally."
    ),
    check(
      hasValue(config.githubWebhookSecret) ? "ok" : "fail",
      "GitHub webhook",
      hasValue(config.githubWebhookSecret)
        ? "Webhook signature secret is configured."
        : "GITHUB_WEBHOOK_SECRET is required."
    ),
    githubApiUsers.length
      ? check(
        githubAuthReady(config) ? "ok" : "fail",
        "GitHub API",
        githubAuthReady(config)
          ? `GitHub ${config.githubAuthProvider} auth is configured.`
          : `GitHub API providers need ${config.githubAuthProvider} credentials.`,
        { providers: githubApiUsers }
      )
      : check("warn", "GitHub API", "No real GitHub API providers are enabled."),
    aiPlannerCheck(config),
    implementationCheck(config),
    validationCheck(config),
    reviewCheck(config),
    ciCheck(config),
    check(
      config.workflowExecutionMode === "async" ? "ok" : "warn",
      "Workflow execution",
      config.workflowExecutionMode === "async"
        ? "Async execution is enabled for long-running workflows."
        : "Sync execution is useful locally but can block approval/retry requests."
    ),
    check(
      ["file", "sqlite"].includes(config.workflowStoreProvider) ? "ok" : "warn",
      "Workflow store",
      config.workflowStoreProvider === "sqlite"
        ? "SQLite workflow persistence is enabled."
        : config.workflowStoreProvider === "file"
          ? "File-backed workflow persistence is enabled."
          : "Memory workflow store is ephemeral.",
      { path: config.workflowStorePath }
    )
  ];

  const summary = checks.some((item) => item.status === "fail")
    ? "fail"
    : checks.some((item) => item.status === "warn")
      ? "warn"
      : "ok";

  return {
    summary,
    checks
  };
}
