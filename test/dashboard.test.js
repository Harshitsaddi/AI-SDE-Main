import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

async function withServer(app, run) {
  await new Promise((resolve) => app.server.listen(0, resolve));
  const port = app.server.address().port;

  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => app.server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("serves the workflow dashboard at the root path", async () => {
  const app = createApp({
    config: {
      githubWebhookSecret: "secret",
      aiProvider: "mock"
    }
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
    assert.match(body, /AI SDE Workflow/);
    assert.match(body, /\/workflows/);
    assert.match(body, /Workflow detail/);
    assert.match(body, /data-view-workflow/);
    assert.match(body, /Repository Inspection/);
    assert.match(body, /AI Settings/);
    assert.match(body, /\/settings\/ai/);
  });
});

test("updates dashboard AI settings without returning the API key", async () => {
  const saved = [];
  const app = createApp({
    config: {
      githubWebhookSecret: "secret",
      aiProvider: "mock"
    },
    aiSettingsStore: {
      getConfigOverrides() {
        return {
          aiProvider: "mock",
          aiModel: "",
          aiApiKey: ""
        };
      },
      getPublicSettings() {
        return {
          provider: "mock",
          model: "",
          supportedProviders: ["mock", "openai"],
          modelsByProvider: {
            openai: ["gpt-test"]
          },
          keyConfigured: {
            openai: false,
            anthropic: false,
            gemini: false
          }
        };
      },
      update(input) {
        saved.push(input);
        return {
          provider: input.provider,
          model: input.model,
          supportedProviders: ["mock", "openai"],
          modelsByProvider: {
            openai: ["gpt-test"]
          },
          keyConfigured: {
            openai: Boolean(input.apiKey),
            anthropic: false,
            gemini: false
          }
        };
      }
    }
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/settings/ai`, {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        provider: "openai",
        model: "gpt-test",
        apiKey: "sk-test-key"
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.provider, "openai");
    assert.equal(body.keyConfigured.openai, true);
    assert.equal(JSON.stringify(body).includes("sk-test-key"), false);
    assert.equal(saved[0].apiKey, "sk-test-key");
  });
});
