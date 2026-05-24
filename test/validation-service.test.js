import test from "node:test";
import assert from "node:assert/strict";
import { CommandError } from "../src/system/commandRunner.js";
import { parseCommandLine } from "../src/validation/commandLine.js";
import { runLocalValidation } from "../src/validation/localValidationService.js";
import { runMockValidation } from "../src/validation/mockValidationService.js";

function workflow(commands = ["npm test", "npm run lint"]) {
  return {
    workspace: {
      path: "C:\\repo"
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

test("parses validation commands without shell execution", () => {
  assert.deepEqual(parseCommandLine("npm run lint"), {
    command: "npm",
    args: ["run", "lint"]
  });
  assert.deepEqual(parseCommandLine("python -m pytest \"tests/unit suite\""), {
    command: "python",
    args: ["-m", "pytest", "tests/unit suite"]
  });
});

test("mock validation records skipped commands", async () => {
  const validation = await runMockValidation({
    workflow: workflow(["npm test"])
  });

  assert.equal(validation.provider, "mock");
  assert.equal(validation.skipped, true);
  assert.equal(validation.passed, null);
  assert.equal(validation.results[0].status, "skipped");
});

test("local validation records passing and failing commands", async () => {
  const calls = [];
  const validation = await runLocalValidation({
    config: {
      validationCommandTimeoutMs: 1000
    },
    workflow: workflow(["npm test", "npm run lint"]),
    commandRunner: async (command, args, options) => {
      calls.push({ command, args, options });

      if (args.includes("lint")) {
        throw new CommandError("Command failed", {
          command,
          args,
          cwd: options.cwd,
          exitCode: 1,
          stdout: "",
          stderr: "lint failed",
          timedOut: false
        });
      }

      return {
        command,
        args,
        cwd: options.cwd,
        exitCode: 0,
        stdout: "tests passed",
        stderr: "",
        timedOut: false
      };
    }
  });

  assert.equal(validation.provider, "local");
  assert.equal(validation.passed, false);
  assert.equal(validation.results[0].status, "passed");
  assert.equal(validation.results[1].status, "failed");
  assert.equal(calls[0].options.cwd, "C:\\repo");
});

test("local validation skips cleanly when no commands are detected", async () => {
  const validation = await runLocalValidation({
    config: {
      validationCommandTimeoutMs: 1000
    },
    workflow: workflow([]),
    commandRunner: async () => {
      throw new Error("should not run");
    }
  });

  assert.equal(validation.skipped, true);
  assert.equal(validation.passed, null);
  assert.deepEqual(validation.results, []);
});
