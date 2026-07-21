import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertCommandAllowed } from "../system/commandPolicy.js";
import { dockerRunArgs } from "../system/containerCommand.js";
import { runCommand } from "../system/commandRunner.js";
import { redactSecrets } from "../system/redaction.js";
import { parseCommandLine } from "../validation/commandLine.js";
import {
  candidateFilesFromWorkflow,
  implementationPromptForWorkflow,
  validationCommandsFromWorkflow
} from "./implementationContext.js";

function renderCommandParts(parts, values) {
  return parts.map((part) => (
    part
      .replaceAll("{promptPath}", values.promptPath)
      .replaceAll("{workspacePath}", values.workspacePath)
      .replaceAll("{workflowId}", values.workflowId)
      .replaceAll("{aiProvider}", values.aiProvider)
      .replaceAll("{aiModel}", values.aiModel)
  ));
}

function implementationModelName(config) {
  const model = config.aiModel || "";

  if (config.aiProvider === "gemini" && model.startsWith("gemini-")) {
    return `gemini/${model}`;
  }

  return model;
}

function truncate(value, maxLength = 4000) {
  if (!value || value.length <= maxLength) {
    return value || "";
  }

  return `${value.slice(0, maxLength)}\n[truncated]`;
}

function outputNeedsClarification(stdout, stderr) {
  const output = `${stdout || ""}\n${stderr || ""}`.toLowerCase();
  return [
    "could you please clarify",
    "please clarify",
    "needs clarification",
    "need clarification",
    "need one clarification",
    "one clarification before",
    "can't safely make the requested change",
    "cannot safely make the requested change",
    "can't safely",
    "cannot safely",
    "to proceed safely",
    "issue description",
    "is ambiguous",
    "too ambiguous",
    "no specific changes",
    "no actionable"
  ].some((phrase) => output.includes(phrase));
}

export async function runCommandImplementation({ config, workflow, commandRunner = runCommand }) {
  if (!workflow.workspace?.path) {
    throw new Error("Workflow workspace path is required for command implementation");
  }

  if (!config.implementationCommand) {
    throw new Error("IMPLEMENTATION_COMMAND is required when IMPLEMENTATION_PROVIDER=command");
  }
  assertCommandAllowed(
    config.implementationCommand,
    config.implementationCommandAllowlist,
    "IMPLEMENTATION_COMMAND_ALLOWLIST"
  );

  const promptDirectory = path.join(workflow.workspace.path, ".ai-sde");
  const promptPath = path.join(promptDirectory, "implementation-prompt.md");
  const prompt = implementationPromptForWorkflow(workflow);
  await mkdir(promptDirectory, { recursive: true });
  await writeFile(promptPath, prompt, "utf8");

  const parsed = parseCommandLine(config.implementationCommand);
  const rendered = renderCommandParts([parsed.command, ...parsed.args], {
    promptPath,
    workspacePath: workflow.workspace.path,
    workflowId: workflow.id,
    aiProvider: config.aiProvider || "",
    aiModel: implementationModelName(config)
  });
  const providerEnv = config.aiProvider === "openai"
    ? { OPENAI_API_KEY: config.aiApiKey || "" }
    : config.aiProvider === "anthropic"
      ? { ANTHROPIC_API_KEY: config.aiApiKey || "" }
      : config.aiProvider === "gemini"
        ? {
          GEMINI_API_KEY: config.aiApiKey || "",
          GOOGLE_API_KEY: config.aiApiKey || "",
          GOOGLE_GENERATIVE_AI_API_KEY: config.aiApiKey || ""
        }
        : {};
  const implementationEnv = {
    AI_SDE_WORKFLOW_ID: workflow.id,
    AI_SDE_IMPLEMENTATION_PROMPT: promptPath,
    AI_SDE_WORKSPACE: workflow.workspace.path,
    AI_SDE_AI_PROVIDER: config.aiProvider || "",
    AI_SDE_AI_MODEL: config.aiModel || "",
    AI_SDE_AI_API_KEY: config.aiApiKey || "",
    ...providerEnv
  };
  const executionCommand = config.implementationContainerImage ? "docker" : rendered[0];
  const executionArgs = config.implementationContainerImage
    ? dockerRunArgs({
      image: config.implementationContainerImage,
      workspacePath: workflow.workspace.path,
      containerWorkdir: config.implementationContainerWorkdir,
      extraArgs: config.implementationContainerExtraArgs,
      envKeys: Object.keys(implementationEnv),
      command: rendered[0],
      args: rendered.slice(1)
    })
    : rendered.slice(1);
  const startedAt = Date.now();
  const result = await commandRunner(executionCommand, executionArgs, {
    cwd: workflow.workspace.path,
    timeoutMs: config.implementationCommandTimeoutMs,
    env: implementationEnv
  });
  const stdout = truncate(redactSecrets(result.stdout, config.secretRedactionPatterns));
  const stderr = truncate(redactSecrets(result.stderr, config.secretRedactionPatterns));
  const needsClarification = outputNeedsClarification(stdout, stderr);

  return {
    provider: "command",
    applied: !needsClarification,
    needsClarification,
    summary: needsClarification
      ? "Implementation agent requested clarification and did not apply code changes."
      : `Implementation command completed successfully: ${config.implementationCommand}`,
    command: {
      command: executionCommand,
      args: executionArgs,
      exitCode: result.exitCode,
      durationMs: Date.now() - startedAt
    },
    container: config.implementationContainerImage
      ? {
        image: config.implementationContainerImage,
        workdir: config.implementationContainerWorkdir
      }
      : null,
    promptPath,
    candidateFiles: candidateFilesFromWorkflow(workflow),
    plannedChanges: workflow.plan.implementationPlan || [],
    validationCommands: validationCommandsFromWorkflow(workflow),
    changedFiles: [],
    stdout,
    stderr,
    diffSummary: "Diff will be captured by the configured diff provider after the command implementation step."
  };
}
