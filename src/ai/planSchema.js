function extractJsonObject(content) {
  const trimmed = String(content || "").trim();
  if (!trimmed) {
    return "";
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

export function parsePlanJson({ stdout, outputContent }) {
  const content = outputContent?.trim() || stdout.trim();

  if (!content) {
    throw new Error("AI planner did not return a plan JSON document");
  }

  return JSON.parse(extractJsonObject(content));
}

export function validatePlan(plan) {
  if (plan.status === "needs_clarification" || plan.status === "awaiting_clarification") {
    if (!Array.isArray(plan.clarificationQuestions) || plan.clarificationQuestions.length === 0) {
      throw new Error("AI planner clarification response is missing array field: clarificationQuestions");
    }
    return;
  }

  const requiredArrays = ["affectedAreas", "implementationPlan", "validationCommands", "humanReviewChecklist"];

  for (const field of ["issueSummary", "proposedBranchName", "risk"]) {
    if (typeof plan[field] !== "string" || !plan[field]) {
      throw new Error(`AI planner plan is missing string field: ${field}`);
    }
  }

  for (const field of requiredArrays) {
    if (!Array.isArray(plan[field])) {
      throw new Error(`AI planner plan is missing array field: ${field}`);
    }
  }
}
