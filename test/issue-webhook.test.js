import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { signPayload } from "../src/github/signature.js";

function issuePayload(overrides = {}) {
  return {
    action: "opened",
    issue: {
      id: 10,
      number: 42,
      title: "Fix login crash",
      body: "The app crashes after login when the user has no avatar.",
      html_url: "https://github.com/acme/app/issues/42",
      labels: [{ name: "bug" }],
      user: { login: "octo" }
    },
    repository: {
      id: 20,
      name: "app",
      full_name: "acme/app",
      default_branch: "main",
      clone_url: "https://github.com/acme/app.git",
      html_url: "https://github.com/acme/app",
      owner: { login: "acme" }
    },
    ...overrides
  };
}

async function withServer(app, run) {
  await new Promise((resolve) => app.server.listen(0, resolve));
  const port = app.server.address().port;

  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => app.server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("creates an awaiting approval workflow for an opened issue webhook", async () => {
  const app = createApp({
    config: {
      githubWebhookSecret: "secret",
      aiProvider: "mock"
    }
  });

  await withServer(app, async (baseUrl) => {
    const rawBody = Buffer.from(JSON.stringify(issuePayload()));
    const response = await fetch(`${baseUrl}/webhooks/github`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "issues",
        "x-hub-signature-256": signPayload("secret", rawBody)
      },
      body: rawBody
    });

    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.status, "awaiting_approval");
    assert.equal(body.workflowId, "acme/app#issue-42");
    assert.equal(body.plan.risk, "medium");
    assert.equal(app.store.list().length, 1);
  });
});

test("ignores issue actions that should not trigger planning", async () => {
  const app = createApp({
    config: {
      githubWebhookSecret: "secret",
      aiProvider: "mock"
    }
  });

  await withServer(app, async (baseUrl) => {
    const rawBody = Buffer.from(JSON.stringify(issuePayload({ action: "closed" })));
    const response = await fetch(`${baseUrl}/webhooks/github`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "issues",
        "x-hub-signature-256": signPayload("secret", rawBody)
      },
      body: rawBody
    });

    const body = await response.json();

    assert.equal(response.status, 202);
    assert.equal(body.status, "ignored");
    assert.equal(app.store.list().length, 0);
  });
});

test("approves a generated workflow through the HTTP API", async () => {
  const app = createApp({
    config: {
      githubWebhookSecret: "secret",
      aiProvider: "mock"
    },
    workspaceService: async ({ workflow }) => ({
      provider: "test",
      workspaceName: "test-workspace",
      path: `C:\\tmp\\${workflow.id}`,
      metadataPath: `C:\\tmp\\${workflow.id}\\metadata.json`,
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
    validationService: async () => ({
      provider: "test",
      passed: null,
      skipped: true,
      commands: [],
      results: [],
      summary: "Validation skipped."
    }),
    diffService: async () => ({
      provider: "test",
      captured: true,
      changedFiles: [],
      diffStat: "",
      diff: "",
      truncated: false
    }),
    reviewService: async () => ({
      provider: "test",
      passed: true,
      severity: "info",
      findings: [],
      summary: "Review passed."
    }),
    pullRequestService: async () => ({
      provider: "test",
      created: false,
      draft: true,
      title: "Fix #42: Fix login crash",
      body: "PR body",
      head: "ai/issue-42",
      base: "main",
      url: "https://github.com/acme/app/pull/new/ai%2Fissue-42",
      number: null
    })
  });

  await withServer(app, async (baseUrl) => {
    const rawBody = Buffer.from(JSON.stringify(issuePayload()));
    const webhookResponse = await fetch(`${baseUrl}/webhooks/github`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "issues",
        "x-hub-signature-256": signPayload("secret", rawBody)
      },
      body: rawBody
    });
    const webhookBody = await webhookResponse.json();

    const approvalResponse = await fetch(
      `${baseUrl}/workflows/${encodeURIComponent(webhookBody.workflowId)}/approve`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          reviewer: "sam",
          comment: "Approved for implementation."
        })
      }
    );
    const approvalBody = await approvalResponse.json();

    assert.equal(approvalResponse.status, 200);
    assert.equal(approvalBody.status, "pr_created");
    assert.equal(approvalBody.workflow.approvals[0].reviewer, "sam");
    assert.equal(approvalBody.workflow.branch.branchName, "ai/issue-42");
    assert.equal(approvalBody.workflow.workspace.workspaceName, "test-workspace");
    assert.equal(approvalBody.workflow.repositoryInspection.inspected, false);
    assert.equal(approvalBody.workflow.implementation.applied, false);
    assert.equal(approvalBody.workflow.diff.captured, true);
    assert.equal(approvalBody.workflow.validation.skipped, true);
    assert.equal(approvalBody.workflow.review.passed, true);
    assert.equal(approvalBody.workflow.pullRequest.title, "Fix #42: Fix login crash");
    assert.equal(approvalBody.workflow.events.at(-1).type, "pr_created");
  });
});

test("records branch creation failure after approval", async () => {
  const app = createApp({
    config: {
      githubWebhookSecret: "secret",
      aiProvider: "mock",
      branchProvider: "mock"
    },
    branchService: async () => {
      throw new Error("GitHub branch API failed");
    }
  });

  await withServer(app, async (baseUrl) => {
    const rawBody = Buffer.from(JSON.stringify(issuePayload()));
    const webhookResponse = await fetch(`${baseUrl}/webhooks/github`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "issues",
        "x-hub-signature-256": signPayload("secret", rawBody)
      },
      body: rawBody
    });
    const webhookBody = await webhookResponse.json();

    const approvalResponse = await fetch(
      `${baseUrl}/workflows/${encodeURIComponent(webhookBody.workflowId)}/approve`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          reviewer: "sam"
        })
      }
    );
    const approvalBody = await approvalResponse.json();

    assert.equal(approvalResponse.status, 200);
    assert.equal(approvalBody.status, "branch_creation_failed");
    assert.equal(approvalBody.workflow.approvals[0].decision, "approved");
    assert.equal(approvalBody.workflow.events.at(-1).type, "branch_creation_failed");
  });
});

test("records workspace preparation failure after branch creation", async () => {
  const app = createApp({
    config: {
      githubWebhookSecret: "secret",
      aiProvider: "mock",
      branchProvider: "mock"
    },
    workspaceService: async () => {
      throw new Error("Workspace disk is unavailable");
    }
  });

  await withServer(app, async (baseUrl) => {
    const rawBody = Buffer.from(JSON.stringify(issuePayload()));
    const webhookResponse = await fetch(`${baseUrl}/webhooks/github`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "issues",
        "x-hub-signature-256": signPayload("secret", rawBody)
      },
      body: rawBody
    });
    const webhookBody = await webhookResponse.json();

    const approvalResponse = await fetch(
      `${baseUrl}/workflows/${encodeURIComponent(webhookBody.workflowId)}/approve`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          reviewer: "sam"
        })
      }
    );
    const approvalBody = await approvalResponse.json();

    assert.equal(approvalResponse.status, 200);
    assert.equal(approvalBody.status, "workspace_preparation_failed");
    assert.equal(approvalBody.workflow.branch.branchName, "ai/issue-42");
    assert.equal(approvalBody.workflow.events.at(-1).type, "workspace_preparation_failed");
  });
});

test("records repository inspection failure after workspace preparation", async () => {
  const app = createApp({
    config: {
      githubWebhookSecret: "secret",
      aiProvider: "mock",
      branchProvider: "mock"
    },
    workspaceService: async ({ workflow }) => ({
      provider: "test",
      workspaceName: "test-workspace",
      path: `C:\\tmp\\${workflow.id}`,
      metadataPath: `C:\\tmp\\${workflow.id}\\metadata.json`,
      repositoryCheckedOut: true
    }),
    inspectionService: async () => {
      throw new Error("Inspection failed");
    }
  });

  await withServer(app, async (baseUrl) => {
    const rawBody = Buffer.from(JSON.stringify(issuePayload()));
    const webhookResponse = await fetch(`${baseUrl}/webhooks/github`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "issues",
        "x-hub-signature-256": signPayload("secret", rawBody)
      },
      body: rawBody
    });
    const webhookBody = await webhookResponse.json();

    const approvalResponse = await fetch(
      `${baseUrl}/workflows/${encodeURIComponent(webhookBody.workflowId)}/approve`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          reviewer: "sam"
        })
      }
    );
    const approvalBody = await approvalResponse.json();

    assert.equal(approvalResponse.status, 200);
    assert.equal(approvalBody.status, "repository_inspection_failed");
    assert.equal(approvalBody.workflow.workspace.repositoryCheckedOut, true);
    assert.equal(approvalBody.workflow.events.at(-1).type, "repository_inspection_failed");
  });
});

test("records implementation failure after repository inspection", async () => {
  const app = createApp({
    config: {
      githubWebhookSecret: "secret",
      aiProvider: "mock",
      branchProvider: "mock"
    },
    workspaceService: async ({ workflow }) => ({
      provider: "test",
      workspaceName: "test-workspace",
      path: `C:\\tmp\\${workflow.id}`,
      metadataPath: `C:\\tmp\\${workflow.id}\\metadata.json`,
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
    implementationService: async () => {
      throw new Error("Implementation agent failed");
    }
  });

  await withServer(app, async (baseUrl) => {
    const rawBody = Buffer.from(JSON.stringify(issuePayload()));
    const webhookResponse = await fetch(`${baseUrl}/webhooks/github`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "issues",
        "x-hub-signature-256": signPayload("secret", rawBody)
      },
      body: rawBody
    });
    const webhookBody = await webhookResponse.json();

    const approvalResponse = await fetch(
      `${baseUrl}/workflows/${encodeURIComponent(webhookBody.workflowId)}/approve`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          reviewer: "sam"
        })
      }
    );
    const approvalBody = await approvalResponse.json();

    assert.equal(approvalResponse.status, 200);
    assert.equal(approvalBody.status, "implementation_failed");
    assert.equal(approvalBody.workflow.repositoryInspection.inspected, false);
    assert.equal(approvalBody.workflow.events.at(-1).type, "implementation_failed");
  });
});

test("records validation failure after implementation", async () => {
  const app = createApp({
    config: {
      githubWebhookSecret: "secret",
      aiProvider: "mock",
      branchProvider: "mock"
    },
    workspaceService: async ({ workflow }) => ({
      provider: "test",
      workspaceName: "test-workspace",
      path: `C:\\tmp\\${workflow.id}`,
      metadataPath: `C:\\tmp\\${workflow.id}\\metadata.json`,
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
    validationService: async () => {
      throw new Error("Validation runner crashed");
    }
  });

  await withServer(app, async (baseUrl) => {
    const rawBody = Buffer.from(JSON.stringify(issuePayload()));
    const webhookResponse = await fetch(`${baseUrl}/webhooks/github`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "issues",
        "x-hub-signature-256": signPayload("secret", rawBody)
      },
      body: rawBody
    });
    const webhookBody = await webhookResponse.json();

    const approvalResponse = await fetch(
      `${baseUrl}/workflows/${encodeURIComponent(webhookBody.workflowId)}/approve`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          reviewer: "sam"
        })
      }
    );
    const approvalBody = await approvalResponse.json();

    assert.equal(approvalResponse.status, 200);
    assert.equal(approvalBody.status, "validation_failed");
    assert.equal(approvalBody.workflow.implementation.applied, false);
    assert.equal(approvalBody.workflow.events.at(-1).type, "validation_failed");
  });
});

test("records diff capture failure after implementation", async () => {
  const app = createApp({
    config: {
      githubWebhookSecret: "secret",
      aiProvider: "mock",
      branchProvider: "mock"
    },
    workspaceService: async ({ workflow }) => ({
      provider: "test",
      workspaceName: "test-workspace",
      path: `C:\\tmp\\${workflow.id}`,
      metadataPath: `C:\\tmp\\${workflow.id}\\metadata.json`,
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
    diffService: async () => {
      throw new Error("Diff capture failed");
    }
  });

  await withServer(app, async (baseUrl) => {
    const rawBody = Buffer.from(JSON.stringify(issuePayload()));
    const webhookResponse = await fetch(`${baseUrl}/webhooks/github`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "issues",
        "x-hub-signature-256": signPayload("secret", rawBody)
      },
      body: rawBody
    });
    const webhookBody = await webhookResponse.json();

    const approvalResponse = await fetch(
      `${baseUrl}/workflows/${encodeURIComponent(webhookBody.workflowId)}/approve`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          reviewer: "sam"
        })
      }
    );
    const approvalBody = await approvalResponse.json();

    assert.equal(approvalResponse.status, 200);
    assert.equal(approvalBody.status, "diff_capture_failed");
    assert.equal(approvalBody.workflow.implementation.applied, false);
    assert.equal(approvalBody.workflow.events.at(-1).type, "diff_capture_failed");
  });
});

test("records review failure after validation", async () => {
  const app = createApp({
    config: {
      githubWebhookSecret: "secret",
      aiProvider: "mock",
      branchProvider: "mock"
    },
    workspaceService: async ({ workflow }) => ({
      provider: "test",
      workspaceName: "test-workspace",
      path: `C:\\tmp\\${workflow.id}`,
      metadataPath: `C:\\tmp\\${workflow.id}\\metadata.json`,
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
      passed: null,
      skipped: true,
      commands: [],
      results: [],
      summary: "Validation skipped."
    }),
    reviewService: async () => {
      throw new Error("Review failed");
    }
  });

  await withServer(app, async (baseUrl) => {
    const rawBody = Buffer.from(JSON.stringify(issuePayload()));
    const webhookResponse = await fetch(`${baseUrl}/webhooks/github`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "issues",
        "x-hub-signature-256": signPayload("secret", rawBody)
      },
      body: rawBody
    });
    const webhookBody = await webhookResponse.json();

    const approvalResponse = await fetch(
      `${baseUrl}/workflows/${encodeURIComponent(webhookBody.workflowId)}/approve`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          reviewer: "sam"
        })
      }
    );
    const approvalBody = await approvalResponse.json();

    assert.equal(approvalResponse.status, 200);
    assert.equal(approvalBody.status, "review_failed");
    assert.equal(approvalBody.workflow.validation.skipped, true);
    assert.equal(approvalBody.workflow.events.at(-1).type, "review_failed");
  });
});

test("records pull request creation failure after review", async () => {
  const app = createApp({
    config: {
      githubWebhookSecret: "secret",
      aiProvider: "mock",
      branchProvider: "mock"
    },
    workspaceService: async ({ workflow }) => ({
      provider: "test",
      workspaceName: "test-workspace",
      path: `C:\\tmp\\${workflow.id}`,
      metadataPath: `C:\\tmp\\${workflow.id}\\metadata.json`,
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
      passed: null,
      skipped: true,
      commands: [],
      results: [],
      summary: "Validation skipped."
    }),
    reviewService: async () => ({
      provider: "test",
      passed: true,
      severity: "info",
      findings: [],
      summary: "Review passed."
    }),
    pullRequestService: async () => {
      throw new Error("Pull request API failed");
    }
  });

  await withServer(app, async (baseUrl) => {
    const rawBody = Buffer.from(JSON.stringify(issuePayload()));
    const webhookResponse = await fetch(`${baseUrl}/webhooks/github`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "issues",
        "x-hub-signature-256": signPayload("secret", rawBody)
      },
      body: rawBody
    });
    const webhookBody = await webhookResponse.json();

    const approvalResponse = await fetch(
      `${baseUrl}/workflows/${encodeURIComponent(webhookBody.workflowId)}/approve`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          reviewer: "sam"
        })
      }
    );
    const approvalBody = await approvalResponse.json();

    assert.equal(approvalResponse.status, 200);
    assert.equal(approvalBody.status, "pr_creation_failed");
    assert.equal(approvalBody.workflow.review.passed, true);
    assert.equal(approvalBody.workflow.events.at(-1).type, "pr_creation_failed");
  });
});
