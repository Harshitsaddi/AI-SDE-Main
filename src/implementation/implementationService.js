import { runMockImplementation } from "./mockImplementationService.js";

export async function runImplementation({ config, workflow }) {
  if (config.implementationProvider === "mock") {
    return runMockImplementation({ workflow });
  }

  throw new Error(`Unsupported IMPLEMENTATION_PROVIDER: ${config.implementationProvider}`);
}
