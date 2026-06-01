import test from "node:test";
import assert from "node:assert/strict";
import { providerHealth } from "../src/health/providerHealth.js";

function baseConfig(overrides = {}) {
  return {
    dashboardToken: "token",
    githubWebhookSecret: "secret",
    branchProvider: "mock",
    prProvider: "mock",
    issueCommentProvider: "none",
    githubAuthProvider: "token",
    githubToken: "",
    githubAppId: "",
    githubAppPrivateKey: "",
    githubAppInstallationId: "",
    aiProvider: "mock",
    aiModel: "",
    aiApiKey: "",
    aiCommand: "",
    aiCommandAllowlist: [],
    implementationProvider: "mock",
    implementationCommand: "",
    implementationCommandAllowlist: [],
    implementationContainerImage: "",
    validationProvider: "mock",
    validationCommandAllowlist: [],
    validationContainerImage: "",
    reviewProvider: "mock",
    ciProvider: "none",
    workflowExecutionMode: "sync",
    workflowStoreProvider: "sqlite",
    workflowStorePath: "var/data/workflows.sqlite",
    ...overrides
  };
}

test("provider health reports ready real providers", () => {
  const health = providerHealth(baseConfig({
    branchProvider: "github_token",
    prProvider: "github_token",
    issueCommentProvider: "github_token",
    githubToken: "ghp_test",
    aiProvider: "openai",
    aiModel: "gpt-test",
    aiApiKey: "sk-test",
    implementationProvider: "command",
    implementationCommand: "aider --yes",
    implementationCommandAllowlist: ["aider"],
    validationProvider: "local",
    validationCommandAllowlist: ["npm test"],
    reviewProvider: "model",
    ciProvider: "github",
    workflowExecutionMode: "async"
  }));

  assert.equal(health.summary, "ok");
  assert.equal(health.checks.every((item) => item.status === "ok"), true);
});

test("provider health flags missing required configuration", () => {
  const health = providerHealth(baseConfig({
    dashboardToken: "",
    githubWebhookSecret: "",
    prProvider: "github_token",
    aiProvider: "gemini",
    aiApiKey: "",
    implementationProvider: "command",
    implementationCommand: "",
    validationProvider: "container",
    validationContainerImage: ""
  }));

  assert.equal(health.summary, "fail");
  assert.ok(health.checks.some((item) => item.name === "GitHub webhook" && item.status === "fail"));
  assert.ok(health.checks.some((item) => item.name === "GitHub API" && item.status === "fail"));
  assert.ok(health.checks.some((item) => item.name === "AI planner" && item.status === "fail"));
  assert.ok(health.checks.some((item) => item.name === "Implementation" && item.status === "fail"));
  assert.ok(health.checks.some((item) => item.name === "Validation" && item.status === "fail"));
});
