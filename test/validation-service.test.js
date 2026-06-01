import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CommandError, resolveCommandForSpawn, runCommand } from "../src/system/commandRunner.js";
import { loadConfig } from "../src/config.js";
import { parseCommandLine } from "../src/validation/commandLine.js";
import { runLocalValidation } from "../src/validation/localValidationService.js";
import { runMockValidation } from "../src/validation/mockValidationService.js";
import { validationCommandsForWorkflow } from "../src/validation/validationCommands.js";

function workflow(commands = ["npm test", "npm run lint"]) {
  return {
    planningInput: {
      repository: {
        fullName: "acme/app"
      }
    },
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
    config: {},
    workflow: workflow(["npm test"])
  });

  assert.equal(validation.provider, "mock");
  assert.equal(validation.skipped, true);
  assert.equal(validation.passed, null);
  assert.equal(validation.results[0].status, "skipped");
});

test("validation command overrides replace detected commands", () => {
  const config = loadConfig({
    VALIDATION_COMMAND_OVERRIDES: JSON.stringify({
      "acme/app": ["npm run ci", "npm run ci", "npm run lint"],
      "*": ["npm test"]
    })
  });

  const commands = validationCommandsForWorkflow(workflow(["npm test"]), config);

  assert.deepEqual(commands, ["npm run ci", "npm run lint"]);
});

test("wildcard validation command overrides apply when repository is not configured", () => {
  const config = loadConfig({
    VALIDATION_COMMAND_OVERRIDES: JSON.stringify({
      "*": ["npm run verify"]
    })
  });
  const targetWorkflow = workflow(["npm test"]);
  targetWorkflow.planningInput.repository.fullName = "acme/other";

  const commands = validationCommandsForWorkflow(targetWorkflow, config);

  assert.deepEqual(commands, ["npm run verify"]);
});

test("local validation records passing and failing commands", async () => {
  const calls = [];
  const validation = await runLocalValidation({
    config: {
      validationCommandTimeoutMs: 1000,
      validationCommandOverrides: {},
      validationCommandAllowlist: [],
      secretRedactionPatterns: ["tenant-secret-[0-9]+"]
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
        stdout: "tests passed tenant-secret-123",
        stderr: "",
        timedOut: false
      };
    }
  });

  assert.equal(validation.provider, "local");
  assert.equal(validation.passed, false);
  assert.equal(validation.results[0].status, "passed");
  assert.equal(validation.results[1].status, "failed");
  assert.equal(validation.results[0].stdout, "tests passed [REDACTED]");
  assert.equal(calls[0].options.cwd, "C:\\repo");
});

test("local validation skips cleanly when no commands are detected", async () => {
  const validation = await runLocalValidation({
    config: {
      validationCommandTimeoutMs: 1000,
      validationCommandOverrides: {},
      validationCommandAllowlist: []
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

test("local validation blocks commands outside the allowlist", async () => {
  const validation = await runLocalValidation({
    config: {
      validationCommandTimeoutMs: 1000,
      validationCommandOverrides: {},
      validationCommandAllowlist: ["npm test"]
    },
    workflow: workflow(["npm test", "npm run lint"]),
    commandRunner: async (command, args, options) => ({
      command,
      args,
      cwd: options.cwd,
      exitCode: 0,
      stdout: "ok",
      stderr: "",
      timedOut: false
    })
  });

  assert.equal(validation.passed, false);
  assert.equal(validation.results[0].status, "passed");
  assert.equal(validation.results[1].status, "blocked");
  assert.match(validation.results[1].stderr, /VALIDATION_COMMAND_ALLOWLIST/);
});

test("local validation records command startup failures", async () => {
  const validation = await runLocalValidation({
    config: {
      validationCommandTimeoutMs: 1000,
      validationCommandOverrides: {},
      validationCommandAllowlist: [],
      secretRedactionPatterns: []
    },
    workflow: workflow(["definitely-missing-ai-sde-command --version"]),
    commandRunner: runCommand
  });

  assert.equal(validation.passed, false);
  assert.equal(validation.results[0].status, "failed");
  assert.equal(validation.results[0].exitCode, null);
  assert.match(validation.results[0].stderr, /Command not found/);
});

test("windows command resolution prefers cmd shims on PATH", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-sde-path-"));
  const npmShim = path.join(tempDir, "npm.cmd");
  fs.writeFileSync(npmShim, "@echo off\r\n");

  assert.equal(
    resolveCommandForSpawn("npm", { PATH: tempDir, PATHEXT: ".COM;.EXE;.BAT;.CMD" }, "win32"),
    npmShim
  );
  assert.equal(resolveCommandForSpawn("npm.cmd", { PATH: tempDir }, "win32"), "npm.cmd");
  assert.equal(resolveCommandForSpawn("npm", { PATH: tempDir }, "linux"), "npm");
});
