import test from "node:test";
import assert from "node:assert/strict";
import { configForRepository, loadConfig } from "../src/config.js";

test("merges repository-specific config overrides", () => {
  const config = loadConfig({
    VALIDATION_PROVIDER: "mock",
    VALIDATION_COMMAND_OVERRIDES: JSON.stringify({
      "*": ["npm test"]
    }),
    REPOSITORY_CONFIG: JSON.stringify({
      "acme/app": {
        validationProvider: "local",
        validationCommands: ["npm run ci"],
        validationCommandAllowlist: ["npm run ci"]
      }
    })
  });
  const repositoryConfig = configForRepository(config, "acme/app");

  assert.equal(repositoryConfig.validationProvider, "local");
  assert.deepEqual(repositoryConfig.validationCommandOverrides["acme/app"], ["npm run ci"]);
  assert.deepEqual(repositoryConfig.validationCommandOverrides["*"], ["npm test"]);
  assert.deepEqual(repositoryConfig.validationCommandAllowlist, ["npm run ci"]);
});

test("keeps global config when repository has no override", () => {
  const config = loadConfig({
    VALIDATION_PROVIDER: "mock",
    REPOSITORY_CONFIG: JSON.stringify({
      "acme/app": {
        validationProvider: "local"
      }
    })
  });
  const repositoryConfig = configForRepository(config, "acme/other");

  assert.equal(repositoryConfig.validationProvider, "mock");
});

test("loads dashboard token from env", () => {
  const config = loadConfig({
    DASHBOARD_TOKEN: "local-secret"
  });

  assert.equal(config.dashboardToken, "local-secret");
});

test("loads workflow execution mode from env", () => {
  const config = loadConfig({
    WORKFLOW_EXECUTION_MODE: "async"
  });

  assert.equal(config.workflowExecutionMode, "async");
});

test("defaults workflow persistence to sqlite", () => {
  const config = loadConfig({});

  assert.equal(config.workflowStoreProvider, "sqlite");
  assert.equal(config.workflowStorePath, "var/data/workflows.sqlite");
});

test("loads CI provider from env", () => {
  const config = loadConfig({
    CI_PROVIDER: "github"
  });

  assert.equal(config.ciProvider, "github");
});
