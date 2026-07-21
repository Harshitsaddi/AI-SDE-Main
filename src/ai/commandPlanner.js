import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parsePlanJson, validatePlan } from "./planSchema.js";
import { assertCommandAllowed } from "../system/commandPolicy.js";
import { runCommand } from "../system/commandRunner.js";
import { redactSecrets } from "../system/redaction.js";
import { parseCommandLine } from "../validation/commandLine.js";

function safeName(value) {
  return String(value || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function renderCommandParts(parts, values) {
  return parts.map((part) => (
    part
      .replaceAll("{inputPath}", values.inputPath)
      .replaceAll("{promptPath}", values.promptPath)
      .replaceAll("{outputPath}", values.outputPath)
      .replaceAll("{repository}", values.repository)
      .replaceAll("{issueNumber}", values.issueNumber)
  ));
}

function plannerPrompt({ planningInput, repositoryContext }) {
  const clarificationComments = planningInput.issue.clarificationComments || [];
  return [
    "# AI SDE Planning Task",
    "",
    `Repository: ${planningInput.repository.fullName}`,
    `Issue: #${planningInput.issue.number} ${planningInput.issue.title}`,
    planningInput.issue.url ? `Issue URL: ${planningInput.issue.url}` : "",
    "",
    "## Issue Body",
    planningInput.issue.body || "No issue body provided.",
    clarificationComments.length ? "" : "",
    clarificationComments.length ? "## Clarification Comments" : "",
    ...clarificationComments.map((comment, index) => (
      `### Comment ${index + 1} by ${comment.author || "unknown"} at ${comment.createdAt || "unknown"}\n${comment.body}`
    )),
    "",
    "## Repository Context",
    JSON.stringify(repositoryContext, null, 2),
    "",
    "Return a JSON implementation plan with these fields: provider, status, issueSummary, proposedBranchName, risk, affectedAreas, implementationPlan, validationCommands, humanReviewChecklist.",
    "Default to returning an implementation plan. Clarification is a last resort, not the default.",
    "Return JSON with status: needs_clarification and clarificationQuestions: string[] only when the requested outcome cannot be determined from the issue, clarification comments, repository context, and conservative engineering assumptions.",
    "Do not ask for confirmation or permission to proceed. Do not ask whether to create files, edit files, add tests, or use a reasonable implementation approach.",
    "Do not ask broad, preference, nice-to-have, or curiosity questions. Ask only focused questions that block implementation because multiple incompatible outcomes are equally plausible.",
    "If the issue body plus clarification comments provide enough context, return a normal implementation plan."
  ].filter(Boolean).join("\n");
}

export async function generateCommandPlan({
  config,
  planningInput,
  repositoryContext,
  commandRunner = runCommand
}) {
  if (!config.aiCommand) {
    throw new Error("AI_COMMAND is required when AI_PROVIDER=command");
  }
  assertCommandAllowed(config.aiCommand, config.aiCommandAllowlist, "AI_COMMAND_ALLOWLIST");

  const workflowKey = `${safeName(planningInput.repository.fullName)}-issue-${safeName(planningInput.issue.number)}`;
  const workDir = path.resolve(config.aiCommandWorkDir, workflowKey);
  const inputPath = path.join(workDir, "planning-input.json");
  const promptPath = path.join(workDir, "planning-prompt.md");
  const outputPath = path.join(workDir, "plan-output.json");
  const input = {
    planningInput,
    repositoryContext
  };
  await mkdir(workDir, { recursive: true });
  await writeFile(inputPath, `${JSON.stringify(input, null, 2)}\n`, "utf8");
  await writeFile(promptPath, plannerPrompt({ planningInput, repositoryContext }), "utf8");

  const parsed = parseCommandLine(config.aiCommand);
  const rendered = renderCommandParts([parsed.command, ...parsed.args], {
    inputPath,
    promptPath,
    outputPath,
    repository: planningInput.repository.fullName,
    issueNumber: String(planningInput.issue.number || "")
  });
  const result = await commandRunner(rendered[0], rendered.slice(1), {
    cwd: workDir,
    timeoutMs: config.aiCommandTimeoutMs,
    env: {
      AI_SDE_PLANNING_INPUT: inputPath,
      AI_SDE_PLANNING_PROMPT: promptPath,
      AI_SDE_PLAN_OUTPUT: outputPath
    }
  });

  let outputContent = "";
  try {
    outputContent = await readFile(outputPath, "utf8");
  } catch {
    outputContent = "";
  }

  const plan = parsePlanJson({
    stdout: redactSecrets(result.stdout, config.secretRedactionPatterns),
    outputContent: redactSecrets(outputContent, config.secretRedactionPatterns)
  });
  validatePlan(plan);

  return {
    ...plan,
    provider: plan.provider || "command",
    status: plan.status || "plan_generated",
    command: {
      command: rendered[0],
      args: rendered.slice(1),
      exitCode: result.exitCode
    },
    artifacts: {
      inputPath,
      promptPath,
      outputPath
    }
  };
}
