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
