import { dockerRunArgs } from "../system/containerCommand.js";
import { isCommandAllowed } from "../system/commandPolicy.js";
import { CommandError, runCommand } from "../system/commandRunner.js";
import { redactSecrets } from "../system/redaction.js";
import { parseCommandLine } from "./commandLine.js";
import { validationCommandsForWorkflow } from "./validationCommands.js";

export async function runContainerValidation({ config, workflow, commandRunner = runCommand }) {
  if (!workflow.workspace?.path) {
    throw new Error("Workflow workspace path is required for container validation");
  }

  if (!config.validationContainerImage) {
    throw new Error("VALIDATION_CONTAINER_IMAGE is required when VALIDATION_PROVIDER=container");
  }

  const commands = validationCommandsForWorkflow(workflow, config);
  const results = [];

  if (!commands.length) {
    return {
      provider: "container",
      passed: null,
      skipped: true,
      image: config.validationContainerImage,
      commands,
      results,
      summary: "No validation commands were detected."
    };
  }

  for (const commandLine of commands) {
    const startedAt = Date.now();

    if (!isCommandAllowed(commandLine, config.validationCommandAllowlist)) {
      results.push({
        command: commandLine,
        status: "blocked",
        exitCode: null,
        stdout: "",
        stderr: "Command blocked by VALIDATION_COMMAND_ALLOWLIST.",
        durationMs: Date.now() - startedAt
      });
      continue;
    }

    const parsed = parseCommandLine(commandLine);
    const dockerArgs = dockerRunArgs({
      image: config.validationContainerImage,
      workspacePath: workflow.workspace.path,
      containerWorkdir: config.validationContainerWorkdir,
      extraArgs: config.validationContainerExtraArgs,
      command: parsed.command,
      args: parsed.args
    });

    try {
      const result = await commandRunner("docker", dockerArgs, {
        cwd: workflow.workspace.path,
        timeoutMs: config.validationCommandTimeoutMs
      });

      results.push({
        command: commandLine,
        status: "passed",
        exitCode: result.exitCode,
        stdout: redactSecrets(result.stdout, config.secretRedactionPatterns),
        stderr: redactSecrets(result.stderr, config.secretRedactionPatterns),
        durationMs: Date.now() - startedAt,
        container: {
          image: config.validationContainerImage,
          args: dockerArgs
        }
      });
    } catch (error) {
      if (error instanceof CommandError) {
        results.push({
          command: commandLine,
          status: error.timedOut ? "timed_out" : "failed",
          exitCode: error.exitCode,
          stdout: redactSecrets(error.stdout, config.secretRedactionPatterns),
          stderr: redactSecrets(error.stderr, config.secretRedactionPatterns),
          durationMs: Date.now() - startedAt,
          container: {
            image: config.validationContainerImage,
            args: dockerArgs
          }
        });
        continue;
      }

      throw error;
    }
  }

  const passed = results.every((result) => result.status === "passed");

  return {
    provider: "container",
    passed,
    skipped: false,
    image: config.validationContainerImage,
    commands,
    results,
    summary: `${results.filter((result) => result.status === "passed").length}/${commands.length} validation command(s) passed in container.`
  };
}
