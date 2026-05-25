import { generateCommandPlan } from "./commandPlanner.js";
import { generateMockPlan } from "./mockPlanner.js";

export async function generatePlan({ config, planningInput, repositoryContext, commandRunner }) {
  if (config.aiProvider === "mock") {
    return generateMockPlan({ planningInput, repositoryContext });
  }

  if (config.aiProvider === "command") {
    return generateCommandPlan({ config, planningInput, repositoryContext, commandRunner });
  }

  throw new Error(`Unsupported AI_PROVIDER: ${config.aiProvider}`);
}
