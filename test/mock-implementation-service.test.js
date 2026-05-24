import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runMockImplementation } from "../src/implementation/mockImplementationService.js";

function workflow(workspacePath) {
  return {
    id: "acme/app#issue-42",
    workspace: {
      path: workspacePath
    },
    plan: {
      affectedAreas: ["To be determined after repository checkout", "src/fallback.ts"],
      implementationPlan: ["Update login fallback handling."],
      validationCommands: ["npm test"]
    },
    repositoryInspection: {
      searchMatches: [
        {
          path: "src/auth.ts"
        },
        {
          path: "src/auth.ts"
        }
      ],
      validationCommands: ["npm test", "npm run lint"]
    }
  };
}

test("records a mock implementation without applying code changes", async () => {
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "ai-sde-implementation-"));
  const implementation = await runMockImplementation({
    workflow: workflow(workspacePath)
  });

  assert.equal(implementation.provider, "mock");
  assert.equal(implementation.applied, false);
  assert.deepEqual(implementation.candidateFiles, ["src/auth.ts", "src/fallback.ts"]);
  assert.deepEqual(implementation.validationCommands, ["npm test", "npm run lint"]);
  assert.deepEqual(implementation.changedFiles, []);

  const output = JSON.parse(await readFile(implementation.outputPath, "utf8"));
  assert.equal(output.summary, "Mock implementation completed. No code changes were applied.");
});

test("falls back to plan validation commands when inspection has none", async () => {
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "ai-sde-implementation-"));
  const currentWorkflow = workflow(workspacePath);
  currentWorkflow.repositoryInspection.validationCommands = [];

  const implementation = await runMockImplementation({
    workflow: currentWorkflow
  });

  assert.deepEqual(implementation.validationCommands, ["npm test"]);
});
