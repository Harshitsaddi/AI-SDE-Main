import { runContainerValidation } from "./containerValidationService.js";
import { runLocalValidation } from "./localValidationService.js";
import { runMockValidation } from "./mockValidationService.js";

export async function runValidation({ config, workflow, commandRunner }) {
  if (config.validationProvider === "mock") {
    return runMockValidation({ config, workflow });
  }

  if (config.validationProvider === "local") {
    return runLocalValidation({ config, workflow, commandRunner });
  }

  if (config.validationProvider === "container") {
    return runContainerValidation({ config, workflow, commandRunner });
  }

  throw new Error(`Unsupported VALIDATION_PROVIDER: ${config.validationProvider}`);
}
