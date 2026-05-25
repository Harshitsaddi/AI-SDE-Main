import { runCommandImplementation } from "./commandImplementationService.js";
import { runMockImplementation } from "./mockImplementationService.js";

export async function runImplementation({ config, workflow, commandRunner }) {
  if (config.implementationProvider === "mock") {
    return runMockImplementation({ workflow });
  }

  if (config.implementationProvider === "command") {
    return runCommandImplementation({ config, workflow, commandRunner });
  }

  throw new Error(`Unsupported IMPLEMENTATION_PROVIDER: ${config.implementationProvider}`);
}
