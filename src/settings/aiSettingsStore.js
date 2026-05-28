import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-latest",
  gemini: "gemini-1.5-pro"
};

const MODEL_PROVIDERS = new Set(["openai", "anthropic", "gemini"]);
const SUPPORTED_PROVIDERS = new Set(["mock", "command", ...MODEL_PROVIDERS]);

function readJsonFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI settings file must contain a JSON object");
  }
  return parsed;
}

function cleanProvider(provider, fallback) {
  const value = String(provider || fallback || "mock");
  if (!SUPPORTED_PROVIDERS.has(value)) {
    throw new Error(`Unsupported AI settings provider: ${value}`);
  }
  return value;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function keyConfiguredFor(data, provider) {
  return Boolean(cleanString(data.apiKeys?.[provider]));
}

export function modelProviders() {
  return [...MODEL_PROVIDERS];
}

export function defaultModelForProvider(provider) {
  return DEFAULT_MODELS[provider] || "";
}

export function createAiSettingsStore(config) {
  const settingsPath = path.resolve(config.aiSettingsPath);
  let data = {
    provider: "",
    modelByProvider: {},
    apiKeys: {},
    ...readJsonFile(settingsPath)
  };

  function save() {
    mkdirSync(path.dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }

  function provider() {
    return cleanProvider(data.provider, config.aiProvider);
  }

  function modelFor(providerName) {
    return cleanString(data.modelByProvider?.[providerName])
      || cleanString(config.aiModel)
      || defaultModelForProvider(providerName);
  }

  return {
    getPublicSettings() {
      const activeProvider = provider();
      return {
        provider: activeProvider,
        model: modelFor(activeProvider),
        supportedProviders: ["mock", "command", ...modelProviders()],
        modelsByProvider: {
          openai: [
            "gpt-4o-mini",
            "gpt-4o",
            "gpt-4.1-mini",
            "gpt-4.1"
          ],
          anthropic: [
            "claude-3-5-sonnet-latest",
            "claude-3-7-sonnet-latest",
            "claude-3-5-haiku-latest"
          ],
          gemini: [
            "gemini-1.5-pro",
            "gemini-1.5-flash",
            "gemini-2.0-flash"
          ]
        },
        keyConfigured: {
          openai: keyConfiguredFor(data, "openai") || Boolean(cleanString(config.openaiApiKey)),
          anthropic: keyConfiguredFor(data, "anthropic") || Boolean(cleanString(config.anthropicApiKey)),
          gemini: keyConfiguredFor(data, "gemini") || Boolean(cleanString(config.geminiApiKey))
        }
      };
    },

    getConfigOverrides() {
      const activeProvider = provider();
      const apiKey = cleanString(data.apiKeys?.[activeProvider])
        || (activeProvider === "openai" ? cleanString(config.openaiApiKey) : "")
        || (activeProvider === "anthropic" ? cleanString(config.anthropicApiKey) : "")
        || (activeProvider === "gemini" ? cleanString(config.geminiApiKey) : "");

      return {
        aiProvider: activeProvider,
        aiModel: modelFor(activeProvider),
        aiApiKey: apiKey
      };
    },

    update(input = {}) {
      const nextProvider = cleanProvider(input.provider, provider());
      const model = cleanString(input.model);
      const apiKey = cleanString(input.apiKey);
      const clearApiKey = input.clearApiKey === true;

      data = {
        ...data,
        provider: nextProvider,
        modelByProvider: {
          ...(data.modelByProvider || {}),
          ...(model ? { [nextProvider]: model } : {})
        },
        apiKeys: {
          ...(data.apiKeys || {})
        }
      };

      if (apiKey) {
        data.apiKeys[nextProvider] = apiKey;
      } else if (clearApiKey) {
        delete data.apiKeys[nextProvider];
      }

      save();
      return this.getPublicSettings();
    }
  };
}
