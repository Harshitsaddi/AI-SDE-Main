import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateCommandPlan } from "../src/ai/commandPlanner.js";

function planningInput() {
  return {
    issue: {
      id: 10,
      number: 42,
      title: "Fix login crash",
      body: "The app crashes after login when the user has no avatar.",
      url: "https://github.com/acme/app/issues/42"
    },
    repository: {
      fullName: "acme/app"
    }
  };
}

function repositoryContext() {
  return {
    candidateFiles: ["src/auth.ts"],
    signals: []
  };
}

function plan() {
  return {
    issueSummary: "Fix login crash.",
    proposedBranchName: "ai/issue-42",
    risk: "medium",
    affectedAreas: ["src/auth.ts"],
    implementationPlan: ["Update fallback handling."],
    validationCommands: ["npm test"],
    humanReviewChecklist: ["Confirm behavior."]
  };
}

test("generates a command plan from stdout JSON", async () => {
  const workDir = await mkdtemp(path.join(os.tmpdir(), "ai-sde-command-planner-"));
  const calls = [];
  const generated = await generateCommandPlan({
    config: {
      aiCommand: "planner --input {inputPath} --prompt {promptPath}",
      aiCommandAllowlist: ["planner"],
      aiCommandTimeoutMs: 1000,
      aiCommandWorkDir: workDir,
      secretRedactionPatterns: []
    },
    planningInput: planningInput(),
    repositoryContext: repositoryContext(),
    commandRunner: async (command, args, options) => {
      calls.push({ command, args, options });
      return {
        command,
        args,
        cwd: options.cwd,
        exitCode: 0,
        stdout: JSON.stringify(plan()),
        stderr: "",
        timedOut: false
      };
    }
  });
  const prompt = await readFile(generated.artifacts.promptPath, "utf8");
  const input = JSON.parse(await readFile(generated.artifacts.inputPath, "utf8"));

  assert.equal(generated.provider, "command");
  assert.equal(generated.status, "plan_generated");
  assert.equal(generated.proposedBranchName, "ai/issue-42");
  assert.equal(calls[0].command, "planner");
  assert.equal(calls[0].options.env.AI_SDE_PLAN_OUTPUT, generated.artifacts.outputPath);
  assert.match(prompt, /Fix login crash/);
  assert.equal(input.planningInput.repository.fullName, "acme/app");
});

test("generates a command plan from output file JSON", async () => {
  const workDir = await mkdtemp(path.join(os.tmpdir(), "ai-sde-command-planner-"));
  const generated = await generateCommandPlan({
    config: {
      aiCommand: "planner --output {outputPath}",
      aiCommandAllowlist: ["planner"],
      aiCommandTimeoutMs: 1000,
      aiCommandWorkDir: workDir,
      secretRedactionPatterns: []
    },
    planningInput: planningInput(),
    repositoryContext: repositoryContext(),
    commandRunner: async (command, args, options) => {
      await writeFile(options.env.AI_SDE_PLAN_OUTPUT, JSON.stringify(plan()), "utf8");
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

  assert.equal(generated.proposedBranchName, "ai/issue-42");
});

test("blocks command planner when command is not allowlisted", async () => {
  await assert.rejects(
    () => generateCommandPlan({
      config: {
        aiCommand: "planner --input {inputPath}",
        aiCommandAllowlist: ["other-planner"],
        aiCommandWorkDir: "var/ai"
      },
      planningInput: planningInput(),
      repositoryContext: repositoryContext(),
      commandRunner: async () => {
        throw new Error("should not run");
      }
    }),
    /AI_COMMAND_ALLOWLIST/
  );
});
