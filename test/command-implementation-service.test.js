import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runCommandImplementation } from "../src/implementation/commandImplementationService.js";

async function workflow() {
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "ai-sde-command-implementation-"));

  return {
    id: "acme/app#issue-42",
    workspace: {
      path: workspacePath
    },
    planningInput: {
      repository: {
        fullName: "acme/app"
      },
      issue: {
        number: 42,
        title: "Fix login crash",
        body: "The app crashes after login when the user has no avatar.",
        url: "https://github.com/acme/app/issues/42"
      }
    },
    plan: {
      affectedAreas: ["src/fallback.ts"],
      implementationPlan: ["Update login fallback handling."],
      validationCommands: ["npm test"]
    },
    repositoryInspection: {
      searchMatches: [
        {
          path: "src/auth.ts"
        }
      ],
      validationCommands: ["npm test", "npm run lint"]
    }
  };
}

test("runs a configured implementation command with prompt placeholders", async () => {
  const currentWorkflow = await workflow();
  const calls = [];
  const implementation = await runCommandImplementation({
    config: {
      implementationCommand: "agent --prompt {promptPath} --workspace {workspacePath}",
      implementationCommandAllowlist: ["agent"],
      implementationCommandTimeoutMs: 1000,
      secretRedactionPatterns: ["tenant-secret-[0-9]+"]
    },
    workflow: currentWorkflow,
    commandRunner: async (command, args, options) => {
      calls.push({ command, args, options });
      return {
        command,
        args,
        cwd: options.cwd,
        exitCode: 0,
        stdout: "changed files with tenant-secret-123",
        stderr: "ghp_abcdefghijklmnopqrstuvwxyz123456",
        timedOut: false
      };
    }
  });
  const prompt = await readFile(implementation.promptPath, "utf8");

  assert.equal(implementation.provider, "command");
  assert.equal(implementation.applied, true);
  assert.equal(calls[0].command, "agent");
  assert.deepEqual(calls[0].args, [
    "--prompt",
    implementation.promptPath,
    "--workspace",
    currentWorkflow.workspace.path
  ]);
  assert.equal(calls[0].options.cwd, currentWorkflow.workspace.path);
  assert.equal(calls[0].options.env.AI_SDE_WORKFLOW_ID, "acme/app#issue-42");
  assert.equal(calls[0].options.env.AI_SDE_IMPLEMENTATION_PROMPT, implementation.promptPath);
  assert.equal(implementation.stdout, "changed files with [REDACTED]");
  assert.equal(implementation.stderr, "[REDACTED]");
  assert.match(prompt, /Fix login crash/);
  assert.match(prompt, /src\/auth\.ts/);
  assert.deepEqual(implementation.validationCommands, ["npm test", "npm run lint"]);
});

test("requires an implementation command for command provider", async () => {
  await assert.rejects(
    () => runCommandImplementation({
      config: {},
      workflow: {
        workspace: {
          path: "C:\\repo"
        }
      }
    }),
    /IMPLEMENTATION_COMMAND is required/
  );
});

test("blocks command implementation when command is not allowlisted", async () => {
  await assert.rejects(
    async () => runCommandImplementation({
      config: {
        implementationCommand: "agent --prompt {promptPath}",
        implementationCommandAllowlist: ["aider"]
      },
      workflow: await workflow(),
      commandRunner: async () => {
        throw new Error("should not run");
      }
    }),
    /IMPLEMENTATION_COMMAND_ALLOWLIST/
  );
});

test("wraps command implementation in docker when configured", async () => {
  const currentWorkflow = await workflow();
  const calls = [];
  const implementation = await runCommandImplementation({
    config: {
      implementationCommand: "agent --prompt {promptPath}",
      implementationCommandAllowlist: ["agent"],
      implementationCommandTimeoutMs: 1000,
      implementationContainerImage: "node:22",
      implementationContainerWorkdir: "/workspace",
      implementationContainerExtraArgs: ["--network", "none"],
      secretRedactionPatterns: []
    },
    workflow: currentWorkflow,
    commandRunner: async (command, args, options) => {
      calls.push({ command, args, options });
      return {
        command,
        args,
        cwd: options.cwd,
        exitCode: 0,
        stdout: "",
        stderr: "",
        timedOut: false
      };
    }
  });

  assert.equal(implementation.container.image, "node:22");
  assert.equal(calls[0].command, "docker");
  assert.equal(calls[0].args[0], "run");
  assert.equal(calls[0].args.includes("node:22"), true);
  assert.equal(calls[0].args.includes("agent"), true);
});
