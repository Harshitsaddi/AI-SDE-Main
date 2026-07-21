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
      affectedAreas: ["src/fallback.ts", "Unknown - No issue body provided"],
      implementationPlan: ["Update login fallback handling."],
      validationCommands: ["npm test"]
    },
    repositoryInspection: {
      repositoryInstructions: [
        {
          path: "AGENTS.md",
          content: "Use focused changes and add tests.",
          truncated: false
        }
      ],
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
      implementationCommand: "agent --model {aiModel} --prompt {promptPath} --workspace {workspacePath}",
      implementationCommandAllowlist: ["agent"],
      implementationCommandTimeoutMs: 1000,
      aiProvider: "openai",
      aiModel: "gpt-test",
      aiApiKey: "sk-test-key",
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
    "--model",
    "gpt-test",
    "--prompt",
    implementation.promptPath,
    "--workspace",
    currentWorkflow.workspace.path
  ]);
  assert.equal(calls[0].options.cwd, currentWorkflow.workspace.path);
  assert.equal(calls[0].options.env.AI_SDE_WORKFLOW_ID, "acme/app#issue-42");
  assert.equal(calls[0].options.env.AI_SDE_IMPLEMENTATION_PROMPT, implementation.promptPath);
  assert.equal(calls[0].options.env.AI_SDE_AI_PROVIDER, "openai");
  assert.equal(calls[0].options.env.AI_SDE_AI_MODEL, "gpt-test");
  assert.equal(calls[0].options.env.AI_SDE_AI_API_KEY, "sk-test-key");
  assert.equal(calls[0].options.env.OPENAI_API_KEY, "sk-test-key");
  assert.equal(implementation.stdout, "changed files with [REDACTED]");
  assert.equal(implementation.stderr, "[REDACTED]");
  assert.match(prompt, /Fix login crash/);
  assert.doesNotMatch(prompt, /https:\/\/github\.com\/acme\/app\/issues\/42/);
  assert.match(prompt, /src\/auth\.ts/);
  assert.doesNotMatch(prompt, /Unknown - No issue body provided/);
  assert.match(prompt, /AGENTS\.md/);
  assert.match(prompt, /Use focused changes and add tests/);
  assert.deepEqual(implementation.validationCommands, ["npm test", "npm run lint"]);
});

test("marks command implementation as needing clarification when the agent asks for it", async () => {
  const implementation = await runCommandImplementation({
    config: {
      implementationCommand: "aider --yes --message-file {promptPath}",
      implementationCommandAllowlist: ["aider"],
      implementationCommandTimeoutMs: 1000,
      aiProvider: "gemini",
      aiModel: "gemini-2.5-flash",
      aiApiKey: "AIza-test-key",
      secretRedactionPatterns: []
    },
    workflow: await workflow(),
    commandRunner: async (command, args, options) => ({
      command,
      args,
      cwd: options.cwd,
      exitCode: 0,
      stdout: "The issue description is ambiguous. Could you please clarify what specific changes are requested?",
      stderr: "",
      timedOut: false
    })
  });

  assert.equal(implementation.applied, false);
  assert.equal(implementation.needsClarification, true);
  assert.match(implementation.summary, /requested clarification/);
});

test("marks safe no-edit aider output as needing clarification", async () => {
  const implementation = await runCommandImplementation({
    config: {
      implementationCommand: "aider --yes --message-file {promptPath}",
      implementationCommandAllowlist: ["aider"],
      implementationCommandTimeoutMs: 1000,
      aiProvider: "openai",
      aiModel: "gpt-5.4-mini",
      aiApiKey: "sk-test-key",
      secretRedactionPatterns: []
    },
    workflow: await workflow(),
    commandRunner: async (command, args, options) => ({
      command,
      args,
      cwd: options.cwd,
      exitCode: 0,
      stdout: "I can't safely make the requested change yet because the task is ambiguous relative to the only file I currently have in full. To proceed safely, please add the routing/navigation files.",
      stderr: "",
      timedOut: false
    })
  });

  assert.equal(implementation.applied, false);
  assert.equal(implementation.needsClarification, true);
  assert.match(implementation.stdout, /can't safely/);
});

test("marks one-clarification aider output as needing clarification", async () => {
  const implementation = await runCommandImplementation({
    config: {
      implementationCommand: "aider --yes --message-file {promptPath}",
      implementationCommandAllowlist: ["aider"],
      implementationCommandTimeoutMs: 1000,
      aiProvider: "openai",
      aiModel: "gpt-5.4-mini",
      aiApiKey: "sk-test-key",
      secretRedactionPatterns: []
    },
    workflow: await workflow(),
    commandRunner: async (command, args, options) => ({
      command,
      args,
      cwd: options.cwd,
      exitCode: 0,
      stdout: "I need one clarification before I can safely edit: should I replace the current app.js module entirely or keep the existing functions and append browser UI code?",
      stderr: "",
      timedOut: false
    })
  });

  assert.equal(implementation.applied, false);
  assert.equal(implementation.needsClarification, true);
});

test("does not treat ordinary safe-change output as clarification", async () => {
  const implementation = await runCommandImplementation({
    config: {
      implementationCommand: "aider --yes --message-file {promptPath}",
      implementationCommandAllowlist: ["aider"],
      implementationCommandTimeoutMs: 1000,
      aiProvider: "openai",
      aiModel: "gpt-5.4-mini",
      aiApiKey: "sk-test-key",
      secretRedactionPatterns: []
    },
    workflow: await workflow(),
    commandRunner: async (command, args, options) => ({
      command,
      args,
      cwd: options.cwd,
      exitCode: 0,
      stdout: "Implemented the smallest safe change and updated tests.",
      stderr: "",
      timedOut: false
    })
  });

  assert.equal(implementation.applied, true);
  assert.equal(implementation.needsClarification, false);
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

test("passes Gemini AI Studio models to implementation commands with the aider namespace", async () => {
  const currentWorkflow = await workflow();
  const calls = [];
  await runCommandImplementation({
    config: {
      implementationCommand: "aider --yes --model {aiModel} --message-file {promptPath}",
      implementationCommandAllowlist: ["aider"],
      implementationCommandTimeoutMs: 1000,
      aiProvider: "gemini",
      aiModel: "gemini-2.5-flash",
      aiApiKey: "AIza-test-key",
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

  assert.deepEqual(calls[0].args.slice(0, 4), [
    "--yes",
    "--model",
    "gemini/gemini-2.5-flash",
    "--message-file"
  ]);
  assert.equal(calls[0].options.env.GEMINI_API_KEY, "AIza-test-key");
  assert.equal(calls[0].options.env.GOOGLE_API_KEY, "AIza-test-key");
});

test("blocks command implementation when command is not allowlisted", async () => {
  await assert.rejects(
    async () => runCommandImplementation({
      config: {
        implementationCommand: "agent --model {aiModel} --prompt {promptPath}",
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
  assert.equal(calls[0].args.includes("-e"), true);
  assert.equal(calls[0].args.includes("AI_SDE_AI_MODEL"), true);
  assert.equal(calls[0].args.includes("OPENAI_API_KEY"), false);
  assert.equal(calls[0].args.includes("node:22"), true);
  assert.equal(calls[0].args.includes("agent"), true);
});
