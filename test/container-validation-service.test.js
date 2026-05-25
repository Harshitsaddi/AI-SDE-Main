import test from "node:test";
import assert from "node:assert/strict";
import { CommandError } from "../src/system/commandRunner.js";
import { runContainerValidation } from "../src/validation/containerValidationService.js";

function workflow(commands = ["npm test"]) {
  return {
    workspace: {
      path: "C:\\repo"
    },
    planningInput: {
      repository: {
        fullName: "acme/app"
      }
    },
    implementation: {
      validationCommands: commands
    },
    repositoryInspection: {
      validationCommands: []
    },
    plan: {
      validationCommands: []
    }
  };
}

test("runs validation commands inside a configured container", async () => {
  const calls = [];
  const validation = await runContainerValidation({
    config: {
      validationContainerImage: "node:22",
      validationContainerWorkdir: "/workspace",
      validationContainerExtraArgs: ["--network", "none"],
      validationCommandTimeoutMs: 1000,
      validationCommandAllowlist: ["npm test"],
      validationCommandOverrides: {},
      secretRedactionPatterns: []
    },
    workflow: workflow(["npm test"]),
    commandRunner: async (command, args, options) => {
      calls.push({ command, args, options });
      return {
        command,
        args,
        cwd: options.cwd,
        exitCode: 0,
        stdout: "ok",
        stderr: "",
        timedOut: false
      };
    }
  });

  assert.equal(validation.provider, "container");
  assert.equal(validation.passed, true);
  assert.equal(calls[0].command, "docker");
  assert.deepEqual(calls[0].args, [
    "run",
    "--rm",
    "-v",
    "C:\\repo:/workspace",
    "-w",
    "/workspace",
    "--network",
    "none",
    "node:22",
    "npm",
    "test"
  ]);
});

test("records container validation failures", async () => {
  const validation = await runContainerValidation({
    config: {
      validationContainerImage: "node:22",
      validationContainerWorkdir: "/workspace",
      validationContainerExtraArgs: [],
      validationCommandTimeoutMs: 1000,
      validationCommandAllowlist: [],
      validationCommandOverrides: {},
      secretRedactionPatterns: []
    },
    workflow: workflow(["npm test"]),
    commandRunner: async (command, args, options) => {
      throw new CommandError("Command failed", {
        command,
        args,
        cwd: options.cwd,
        exitCode: 1,
        stdout: "",
        stderr: "failed",
        timedOut: false
      });
    }
  });

  assert.equal(validation.passed, false);
  assert.equal(validation.results[0].status, "failed");
});
