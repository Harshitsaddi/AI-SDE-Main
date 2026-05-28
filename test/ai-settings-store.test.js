import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createAiSettingsStore } from "../src/settings/aiSettingsStore.js";

test("stores dashboard AI provider, model, and API key without exposing the key", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-sde-settings-"));
  const settingsPath = path.join(root, "ai-settings.json");
  const store = createAiSettingsStore({
    aiProvider: "mock",
    aiModel: "",
    aiSettingsPath: settingsPath,
    openaiApiKey: "",
    anthropicApiKey: "",
    geminiApiKey: ""
  });

  const publicSettings = store.update({
    provider: "openai",
    model: "gpt-test",
    apiKey: "sk-test-dashboard-key"
  });

  assert.equal(publicSettings.provider, "openai");
  assert.equal(publicSettings.model, "gpt-test");
  assert.equal(publicSettings.keyConfigured.openai, true);
  assert.equal(JSON.stringify(publicSettings).includes("sk-test-dashboard-key"), false);

  assert.deepEqual(store.getConfigOverrides(), {
    aiProvider: "openai",
    aiModel: "gpt-test",
    aiApiKey: "sk-test-dashboard-key"
  });

  const persisted = JSON.parse(await readFile(settingsPath, "utf8"));
  assert.equal(persisted.apiKeys.openai, "sk-test-dashboard-key");
});

test("can clear a saved API key for the selected provider", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-sde-settings-"));
  const store = createAiSettingsStore({
    aiProvider: "mock",
    aiModel: "",
    aiSettingsPath: path.join(root, "ai-settings.json"),
    openaiApiKey: "",
    anthropicApiKey: "",
    geminiApiKey: ""
  });

  store.update({
    provider: "gemini",
    model: "gemini-test",
    apiKey: "AIza-test-dashboard-key"
  });
  const publicSettings = store.update({
    provider: "gemini",
    clearApiKey: true
  });

  assert.equal(publicSettings.keyConfigured.gemini, false);
  assert.equal(store.getConfigOverrides().aiApiKey, "");
});
