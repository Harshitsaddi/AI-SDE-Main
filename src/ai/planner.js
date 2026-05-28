import { generateCommandPlan } from "./commandPlanner.js";
import { generateModelPlan } from "./modelPlanner.js";
import { generateMockPlan } from "./mockPlanner.js";

export async function generatePlan({ config, planningInput, repositoryContext, commandRunner, fetchImpl }) {
  if (config.aiProvider === "mock") {
    return generateMockPlan({ planningInput, repositoryContext });
  }

  if (config.aiProvider === "command") {
    return generateCommandPlan({ config, planningInput, repositoryContext, commandRunner });
  }

  if (["openai", "anthropic", "gemini"].includes(config.aiProvider)) {
    return generateModelPlan({ config, planningInput, repositoryContext, fetchImpl });
  }

  throw new Error(`Unsupported AI_PROVIDER: ${config.aiProvider}`);
}
