import { parsePlanJson, validatePlan } from "./planSchema.js";
import { defaultModelForProvider } from "../settings/aiSettingsStore.js";
import { redactSecrets } from "../system/redaction.js";

const PROVIDER_NAMES = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini"
};

function planningPrompt({ planningInput, repositoryContext }) {
  const clarificationComments = planningInput.issue.clarificationComments || [];
  return [
    "You are an AI software engineering planner.",
    "Return only valid JSON. Do not wrap the JSON in markdown.",
    "The JSON object must contain these fields:",
    "provider, status, issueSummary, proposedBranchName, risk, affectedAreas, implementationPlan, validationCommands, humanReviewChecklist.",
    "Default to returning an implementation plan. Clarification is a last resort, not the default.",
    "Return status: needs_clarification only when the requested outcome cannot be determined from the issue, clarification comments, repository context, and conservative engineering assumptions.",
    "Do not ask for confirmation or permission to proceed. Do not ask whether to create files, edit files, add tests, or use a reasonable implementation approach.",
    "Do not ask broad, preference, nice-to-have, or curiosity questions. Ask only focused questions that block implementation because multiple incompatible outcomes are equally plausible.",
    "If the original issue plus clarification comments provide enough context, return a normal implementation plan even if the comment does not explicitly answer every previous question.",
    "risk must be a string with one of: low, medium, high.",
    "Use short, actionable strings in every array.",
    "",
    `Repository: ${planningInput.repository.fullName}`,
    `Issue: #${planningInput.issue.number} ${planningInput.issue.title}`,
    planningInput.issue.url ? `Issue URL: ${planningInput.issue.url}` : "",
    "",
    "Issue body:",
    planningInput.issue.body || "No issue body provided.",
    clarificationComments.length ? "" : "",
    clarificationComments.length ? "Clarification comments:" : "",
    ...clarificationComments.map((comment, index) => (
      `Comment ${index + 1} by ${comment.author || "unknown"} at ${comment.createdAt || "unknown"}:\n${comment.body}`
    )),
    "",
    "Repository context:",
    JSON.stringify(repositoryContext, null, 2)
  ].filter(Boolean).join("\n");
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function stringArray(value, fallback = []) {
  if (Array.isArray(value)) {
    const strings = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);

    return strings.length ? strings : fallback;
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
  }

  return fallback;
}

function safeBranchName(planningInput) {
  return `ai/issue-${planningInput.issue.number || planningInput.issue.id || "unknown"}`;
}

function isConfirmationQuestion(question) {
  const normalized = question.toLowerCase();

  return [
    "confirm",
    "permission",
    "proceed",
    "go ahead",
    "should i create",
    "should i edit",
    "should i add",
    "would you like me",
    "do you want me"
  ].some((phrase) => normalized.includes(phrase));
}

function normalizeModelPlan({ plan, planningInput, repositoryContext }) {
  const clarificationQuestions = stringArray(plan.clarificationQuestions, stringArray(plan.questions))
    .filter((question) => !isConfirmationQuestion(question));
  const status = firstString(plan.status);

  if (status === "needs_clarification" || status === "awaiting_clarification" || clarificationQuestions.length) {
    if (!clarificationQuestions.length) {
      return {
        ...plan,
        status: "plan_generated",
        issueSummary: firstString(plan.issueSummary, plan.summary, planningInput.issue.title),
        proposedBranchName: firstString(plan.proposedBranchName, plan.branchName) || safeBranchName(planningInput),
        risk: firstString(plan.risk, plan.riskLevel, plan.riskAssessment) || "medium",
        affectedAreas: stringArray(
          plan.affectedAreas,
          stringArray(plan.files, repositoryContext.candidateFiles || ["To be determined after repository checkout"])
        ),
        implementationPlan: stringArray(plan.implementationPlan, [
          "Inspect the files related to the issue.",
          "Make the smallest safe change that resolves the issue.",
          "Add or update focused tests for the changed behavior."
        ]),
        validationCommands: stringArray(plan.validationCommands, ["npm test"]),
        humanReviewChecklist: stringArray(plan.humanReviewChecklist, [
          "Confirm the implementation matches the issue.",
          "Confirm validation results are acceptable."
        ])
      };
    }

    return {
      provider: plan.provider,
      status: "needs_clarification",
      issueSummary: firstString(plan.issueSummary, plan.summary, planningInput.issue.title),
      clarificationQuestions,
      clarificationContext: firstString(plan.clarificationContext, plan.reason, plan.rationale)
    };
  }

  return {
    ...plan,
    status: status || "plan_generated",
    issueSummary: firstString(plan.issueSummary, plan.summary, planningInput.issue.title),
    proposedBranchName: firstString(plan.proposedBranchName, plan.branchName) || safeBranchName(planningInput),
    risk: firstString(plan.risk, plan.riskLevel, plan.riskAssessment) || "medium",
    affectedAreas: stringArray(
      plan.affectedAreas,
      stringArray(plan.files, repositoryContext.candidateFiles || ["To be determined after repository checkout"])
    ),
    implementationPlan: stringArray(plan.implementationPlan, [
      "Inspect the files related to the issue.",
      "Make the smallest safe change that resolves the issue.",
      "Add or update focused tests for the changed behavior."
    ]),
    validationCommands: stringArray(plan.validationCommands, ["npm test"]),
    humanReviewChecklist: stringArray(plan.humanReviewChecklist, [
      "Confirm the implementation matches the issue.",
      "Confirm validation results are acceptable."
    ])
  };
}

async function parseJsonResponse(response) {
  const text = await response.text();
  let body;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message = body?.error?.message || body?.message || text || response.statusText;
    throw new Error(`AI provider request failed (${response.status}): ${message}`);
  }

  return body;
}

async function callOpenAi({ config, prompt, fetchImpl }) {
  const body = await parseJsonResponse(await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.aiApiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.aiModel || defaultModelForProvider("openai"),
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "You create implementation plans as strict JSON for an automated software workflow."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  }));

  return body?.choices?.[0]?.message?.content || "";
}

async function callAnthropic({ config, prompt, fetchImpl }) {
  const body = await parseJsonResponse(await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.aiApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.aiModel || defaultModelForProvider("anthropic"),
      max_tokens: 4000,
      temperature: 0.2,
      system: "You create implementation plans as strict JSON for an automated software workflow.",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  }));

  return (body?.content || [])
    .filter((part) => part?.type === "text")
    .map((part) => part.text)
    .join("\n");
}

async function callGemini({ config, prompt, fetchImpl }) {
  const model = encodeURIComponent(config.aiModel || defaultModelForProvider("gemini"));
  const apiKey = encodeURIComponent(config.aiApiKey);
  const body = await parseJsonResponse(await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      })
    }
  ));

  return (body?.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text || "")
    .join("\n");
}

export async function generateModelPlan({
  config,
  planningInput,
  repositoryContext,
  fetchImpl = fetch
}) {
  const provider = config.aiProvider;

  if (!config.aiApiKey) {
    throw new Error(`${PROVIDER_NAMES[provider] || provider} API key is required. Set it in the dashboard AI settings.`);
  }

  const prompt = planningPrompt({ planningInput, repositoryContext });
  const content = provider === "openai"
    ? await callOpenAi({ config, prompt, fetchImpl })
    : provider === "anthropic"
      ? await callAnthropic({ config, prompt, fetchImpl })
      : await callGemini({ config, prompt, fetchImpl });

  const plan = normalizeModelPlan({
    plan: parsePlanJson({
      stdout: redactSecrets(content, config.secretRedactionPatterns),
      outputContent: ""
    }),
    planningInput,
    repositoryContext
  });
  validatePlan(plan);

  return {
    ...plan,
    provider: `${provider}:${config.aiModel || defaultModelForProvider(provider)}`,
    status: plan.status || "plan_generated"
  };
}
