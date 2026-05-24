import { validationCommandsForWorkflow } from "./validationCommands.js";

export async function runMockValidation({ workflow }) {
  const commands = validationCommandsForWorkflow(workflow);

  return {
    provider: "mock",
    passed: null,
    skipped: true,
    commands,
    results: commands.map((command) => ({
      command,
      status: "skipped",
      exitCode: null,
      stdout: "",
      stderr: "",
      durationMs: 0
    })),
    summary: commands.length
      ? `Mock validation skipped ${commands.length} command(s).`
      : "Mock validation skipped because no commands were detected."
  };
}
