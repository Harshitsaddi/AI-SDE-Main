import { parsePlanJson, validatePlan } from "./planSchema.js";
import { defaultModelForProvider } from "../settings/aiSettingsStore.js";
import { redactSecrets } from "../system/redaction.js";

const PROVIDER_NAMES = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini"
};

function planningPrompt({ planningInput, repositoryContext }) {
  return [
    "You are an AI software engineering planner.",
    "Return only valid JSON. Do not wrap the JSON in markdown.",
    "The JSON object must contain these fields:",
    "provider, status, issueSummary, proposedBranchName, risk, affectedAreas, implementationPlan, validationCommands, humanReviewChecklist.",
    "Use short, actionable strings in every array.",
    "",
    `Repository: ${planningInput.repository.fullName}`,
    `Issue: #${planningInput.issue.number} ${planningInput.issue.title}`,
    planningInput.issue.url ? `Issue URL: ${planningInput.issue.url}` : "",
    "",
    "Issue body:",
    planningInput.issue.body || "No issue body provided.",
    "",
    "Repository context:",
    JSON.stringify(repositoryContext, null, 2)
  ].filter(Boolean).join("\n");
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

  const plan = parsePlanJson({
    stdout: redactSecrets(content, config.secretRedactionPatterns),
    outputContent: ""
  });
  validatePlan(plan);

  return {
    ...plan,
    provider: `${provider}:${config.aiModel || defaultModelForProvider(provider)}`,
    status: plan.status || "plan_generated"
  };
}
