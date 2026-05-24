import { CommandError, runCommand } from "../system/commandRunner.js";
import { parseCommandLine } from "./commandLine.js";
import { validationCommandsForWorkflow } from "./validationCommands.js";

export async function runLocalValidation({ config, workflow, commandRunner = runCommand }) {
  if (!workflow.workspace?.path) {
    throw new Error("Workflow workspace path is required for validation");
  }

  const commands = validationCommandsForWorkflow(workflow);
  const results = [];

  if (!commands.length) {
    return {
      provider: "local",
      passed: null,
      skipped: true,
      commands,
      results,
      summary: "No validation commands were detected."
    };
  }

  for (const commandLine of commands) {
    const startedAt = Date.now();
    const parsed = parseCommandLine(commandLine);

    try {
      const result = await commandRunner(parsed.command, parsed.args, {
        cwd: workflow.workspace.path,
        timeoutMs: config.validationCommandTimeoutMs
      });

      results.push({
        command: commandLine,
        status: "passed",
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: Date.now() - startedAt
      });
    } catch (error) {
      if (error instanceof CommandError) {
        results.push({
          command: commandLine,
          status: error.timedOut ? "timed_out" : "failed",
          exitCode: error.exitCode,
          stdout: error.stdout,
          stderr: error.stderr,
          durationMs: Date.now() - startedAt
        });
        continue;
      }

      throw error;
    }
  }

  const passed = results.every((result) => result.status === "passed");

  return {
    provider: "local",
    passed,
    skipped: false,
    commands,
    results,
    summary: `${results.filter((result) => result.status === "passed").length}/${commands.length} validation command(s) passed.`
  };
}
