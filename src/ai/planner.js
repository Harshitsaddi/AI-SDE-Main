import { generateMockPlan } from "./mockPlanner.js";

export async function generatePlan({ config, planningInput, repositoryContext }) {
  if (config.aiProvider === "mock") {
    return generateMockPlan({ planningInput, repositoryContext });
  }

  throw new Error(`Unsupported AI_PROVIDER: ${config.aiProvider}`);
}
