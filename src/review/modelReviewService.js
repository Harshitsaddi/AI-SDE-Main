import { defaultModelForProvider } from "../settings/aiSettingsStore.js";
import { redactSecrets } from "../system/redaction.js";

const PROVIDER_NAMES = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini"
};

const SEVERITIES = new Set(["info", "low", "medium", "high"]);

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
    throw new Error(`AI review provider request failed (${response.status}): ${message}`);
  }

  return body;
}

function parseReviewJson(content) {
  const trimmed = String(content || "").trim();
  const unwrapped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  try {
    return JSON.parse(unwrapped);
  } catch (error) {
    throw new Error(`AI review response was not valid JSON: ${error.message}`);
  }
}

function cleanSeverity(value, fallback = "low") {
  const severity = String(value || "").toLowerCase();
  return SEVERITIES.has(severity) ? severity : fallback;
}

function maxSeverity(findings) {
  const rank = {
    info: 0,
    low: 1,
    medium: 2,
    high: 3
  };

  return findings.reduce((current, finding) => (
    rank[finding.severity] > rank[current] ? finding.severity : current
  ), "low");
}

function normalizeFinding(finding) {
  return {
    severity: cleanSeverity(finding?.severity, "medium"),
    title: String(finding?.title || "Review finding").trim(),
    body: String(finding?.body || finding?.message || "").trim(),
    path: finding?.path ? String(finding.path) : null,
    line: Number.isInteger(finding?.line) ? finding.line : null
  };
}

function normalizeReview(review, provider) {
  const findings = Array.isArray(review?.findings)
    ? review.findings.map(normalizeFinding).filter((finding) => finding.body)
    : [];
  const severity = cleanSeverity(review?.severity, maxSeverity(findings));
  const passed = typeof review?.passed === "boolean"
    ? review.passed
    : !findings.some((finding) => finding.severity === "high");

  return {
    provider,
    passed,
    severity,
    findings,
    summary: String(review?.summary || (
      findings.length
        ? `Model review completed with ${findings.length} finding(s).`
        : "Model review completed with no findings."
    )).trim()
  };
}

function truncate(value, maxLength = 12000) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n[truncated]` : text;
}

function reviewPrompt(workflow) {
  return [
    "You are a senior software engineer reviewing an automated code change.",
    "Return only valid JSON. Do not wrap the JSON in markdown.",
    "The JSON object must contain: passed boolean, severity string, summary string, findings array.",
    "Each finding must contain: severity, title, body, path, and optional line.",
    "Severity must be one of: info, low, medium, high.",
    "Use high severity only for likely correctness, security, data loss, or build-breaking issues.",
    "",
    "Workflow:",
    JSON.stringify({
      id: workflow.id,
      issue: workflow.planningInput?.issue,
      plan: workflow.plan,
      implementation: workflow.implementation,
      diffStat: workflow.diff?.diffStat,
      changedFiles: workflow.diff?.changedFiles,
      validation: workflow.validation
    }, null, 2),
    "",
    "Patch:",
    truncate(workflow.diff?.diff || "")
  ].join("\n");
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
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: "You review code changes and return strict JSON."
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
      temperature: 0.1,
      system: "You review code changes and return strict JSON.",
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
          temperature: 0.1,
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

export async function runModelReview({ config, workflow, fetchImpl = fetch }) {
  const provider = config.aiProvider;

  if (!["openai", "anthropic", "gemini"].includes(provider)) {
    throw new Error("REVIEW_PROVIDER=model requires AI_PROVIDER to be openai, anthropic, or gemini.");
  }

  if (!config.aiApiKey) {
    throw new Error(`${PROVIDER_NAMES[provider]} API key is required for model review. Set it in the dashboard AI settings.`);
  }

  const prompt = reviewPrompt(workflow);
  const content = provider === "openai"
    ? await callOpenAi({ config, prompt, fetchImpl })
    : provider === "anthropic"
      ? await callAnthropic({ config, prompt, fetchImpl })
      : await callGemini({ config, prompt, fetchImpl });

  return normalizeReview(
    parseReviewJson(redactSecrets(content, config.secretRedactionPatterns)),
    `model:${provider}:${config.aiModel || defaultModelForProvider(provider)}`
  );
}
