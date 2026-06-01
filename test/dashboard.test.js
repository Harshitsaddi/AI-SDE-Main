import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { WorkflowStore } from "../src/workflows/store.js";

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
    assert.match(body, /Readiness/);
    assert.match(body, /\/settings\/ai/);
    assert.match(body, /\/health\/providers/);
    assert.match(body, /Changed Files/);
    assert.match(body, /Patch Preview/);
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

test("requires dashboard token for workflow and settings APIs when configured", async () => {
  const app = createApp({
    config: {
      dashboardToken: "local-secret",
      githubWebhookSecret: "secret",
      aiProvider: "mock"
    }
  });

  await withServer(app, async (baseUrl) => {
    const unauthorized = await fetch(`${baseUrl}/workflows`);
    const healthUnauthorized = await fetch(`${baseUrl}/health/providers`);
    const authorized = await fetch(`${baseUrl}/workflows`, {
      headers: {
        authorization: "Bearer local-secret"
      }
    });
    const healthAuthorized = await fetch(`${baseUrl}/health/providers`, {
      headers: {
        authorization: "Bearer local-secret"
      }
    });
    const health = await fetch(`${baseUrl}/health`);

    assert.equal(unauthorized.status, 401);
    assert.equal(healthUnauthorized.status, 401);
    assert.equal(authorized.status, 200);
    assert.equal(healthAuthorized.status, 200);
    assert.equal(health.status, 200);
  });
});

test("rejects concurrent retries for the same workflow", async () => {
  const store = new WorkflowStore();
  const workflow = store.createFromPlan({
    planningInput: {
      repository: {
        fullName: "acme/app"
      },
      issue: {
        number: 42,
        title: "Fix bug"
      }
    },
    plan: {
      provider: "mock",
      status: "planned"
    }
  });
  store.markValidationFailed(workflow.id, new Error("tests failed"));

  const app = createApp({
    config: {
      githubWebhookSecret: "secret",
      aiProvider: "mock"
    },
    store,
    validationService: async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        provider: "mock",
        passed: true,
        skipped: false,
        commands: [],
        results: [],
        summary: "Validation passed."
      };
    },
    reviewService: async () => ({
      provider: "mock",
      passed: true,
      severity: "low",
      findings: [],
      summary: "Review passed."
    }),
    pullRequestService: async () => ({
      provider: "mock",
      created: false,
      title: "Mock PR"
    })
  });

  await withServer(app, async (baseUrl) => {
    const url = `${baseUrl}/workflows/${encodeURIComponent(workflow.id)}/retry`;
    const first = fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        reviewer: "sam"
      })
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        reviewer: "sam"
      })
    });
    const firstResponse = await first;
    const secondBody = await second.json();

    assert.equal(firstResponse.status, 200);
    assert.equal(second.status, 409);
    assert.equal(secondBody.error, "workflow_pipeline_running");
  });
});

test("async workflow execution queues approval and completes in the background", async () => {
  const store = new WorkflowStore();
  const workflow = store.createFromPlan({
    planningInput: {
      repository: {
        fullName: "acme/app"
      },
      issue: {
        number: 43,
        title: "Add feature"
      }
    },
    plan: {
      provider: "mock",
      status: "planned"
    }
  });

  const app = createApp({
    config: {
      workflowExecutionMode: "async",
      githubWebhookSecret: "secret",
      aiProvider: "mock"
    },
    store,
    branchService: async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      return {
        provider: "test",
        branchName: "ai/issue-43",
        baseBranch: "main",
        baseSha: "abc123",
        created: true
      };
    },
    workspaceService: async () => ({
      provider: "test",
      workspaceName: "workspace",
      path: "C:\\tmp\\workspace",
      metadataPath: "C:\\tmp\\workspace\\metadata.json",
      repositoryCheckedOut: false
    }),
    inspectionService: async () => ({
      provider: "test",
      inspected: false,
      reason: "repository_not_checked_out",
      fileTree: [],
      importantFiles: [],
      techStack: [],
      validationCommands: [],
      searchMatches: []
    }),
    implementationService: async () => ({
      provider: "test",
      applied: false,
      summary: "Implementation dry run.",
      candidateFiles: [],
      plannedChanges: [],
      validationCommands: [],
      changedFiles: [],
      diffSummary: "No diff."
    }),
    diffService: async () => ({
      provider: "test",
      captured: true,
      changedFiles: [],
      diffStat: "",
      diff: "",
      truncated: false
    }),
    validationService: async () => ({
      provider: "test",
      passed: true,
      skipped: false,
      commands: [],
      results: [],
      summary: "Validation passed."
    }),
    reviewService: async () => ({
      provider: "test",
      passed: true,
      severity: "low",
      findings: [],
      summary: "Review passed."
    }),
    pullRequestService: async () => ({
      provider: "test",
      created: false,
      title: "Mock PR"
    })
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/workflows/${encodeURIComponent(workflow.id)}/approve`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        reviewer: "sam"
      })
    });
    const body = await response.json();

    assert.equal(response.status, 202);
    assert.equal(body.status, "queued");
    assert.equal(body.workflow.queuedStage, "branch");

    await app.queue.drain();
    assert.equal(store.get(workflow.id).status, "pr_created");
  });
});
