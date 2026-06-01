import test from "node:test";
import assert from "node:assert/strict";
import { createGitHubPullRequest } from "../src/pullRequests/githubPullRequestService.js";
import { createMockPullRequest } from "../src/pullRequests/mockPullRequestService.js";
import { buildPullRequestBody, buildPullRequestTitle } from "../src/pullRequests/pullRequestBody.js";

function workflow() {
  return {
    planningInput: {
      issue: {
        number: 42,
        title: "Fix login crash",
        url: "https://github.com/acme/app/issues/42"
      },
      repository: {
        fullName: "acme/app",
        defaultBranch: "main",
        htmlUrl: "https://github.com/acme/app"
      }
    },
    branch: {
      branchName: "ai/issue-42"
    },
    plan: {
      issueSummary: "Fix login crash.",
      implementationPlan: ["Update login fallback.", "Add a focused test."]
    },
    implementation: {
      summary: "Updated login fallback handling."
    },
    diff: {
      changedFiles: [
        {
          status: "M",
          path: "src/auth.ts"
        }
      ]
    },
    validation: {
      skipped: false,
      results: [
        {
          status: "passed",
          command: "npm test",
          durationMs: 120
        }
      ]
    },
    review: {
      summary: "Review passed.",
      findings: []
    }
  };
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  };
}

test("builds pull request title and body from workflow artifacts", () => {
  const title = buildPullRequestTitle(workflow());
  const body = buildPullRequestBody(workflow());

  assert.equal(title, "Fix #42: Fix login crash");
  assert.match(body, /Updated login fallback handling/);
  assert.match(body, /M: `src\/auth.ts`/);
  assert.match(body, /PASSED: `npm test`/);
});

test("creates a mock pull request artifact", async () => {
  const pullRequest = await createMockPullRequest({
    config: {
      prDraft: true
    },
    workflow: workflow()
  });

  assert.equal(pullRequest.provider, "mock");
  assert.equal(pullRequest.created, false);
  assert.equal(pullRequest.draft, true);
  assert.equal(pullRequest.head, "ai/issue-42");
  assert.equal(pullRequest.base, "main");
  assert.match(pullRequest.url, /pull\/new/);
});

test("creates a GitHub pull request through the API", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("/pulls?")) {
      return response(200, []);
    }

    return response(201, {
      number: 12,
      html_url: "https://github.com/acme/app/pull/12",
      title: "Fix #42: Fix login crash",
      body: "body",
      draft: true
    });
  };

  const pullRequest = await createGitHubPullRequest({
    config: {
      githubToken: "token",
      githubApiBaseUrl: "https://api.github.test",
      prDraft: true
    },
    workflow: workflow(),
    fetchImpl
  });

  assert.equal(pullRequest.provider, "github_token");
  assert.equal(pullRequest.created, true);
  assert.equal(pullRequest.number, 12);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://api.github.test/repos/acme/app/pulls?state=open&head=acme%3Aai%2Fissue-42&base=main");
  assert.equal(calls[1].url, "https://api.github.test/repos/acme/app/pulls");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    title: "Fix #42: Fix login crash",
    head: "ai/issue-42",
    base: "main",
    body: buildPullRequestBody(workflow()),
    draft: true
  });
});

test("reuses an existing open GitHub pull request for the workflow branch", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return response(200, [
      {
        number: 12,
        html_url: "https://github.com/acme/app/pull/12",
        title: "Fix #42: Fix login crash",
        body: "existing body",
        draft: true
      }
    ]);
  };

  const pullRequest = await createGitHubPullRequest({
    config: {
      githubToken: "token",
      githubApiBaseUrl: "https://api.github.test",
      prDraft: true
    },
    workflow: workflow(),
    fetchImpl
  });

  assert.equal(pullRequest.provider, "github_token");
  assert.equal(pullRequest.created, false);
  assert.equal(pullRequest.existing, true);
  assert.equal(pullRequest.number, 12);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.github.test/repos/acme/app/pulls?state=open&head=acme%3Aai%2Fissue-42&base=main");
});

test("pushes a checked out workspace branch before creating a GitHub pull request", async () => {
  const calls = [];
  const commandCalls = [];
  const targetWorkflow = {
    ...workflow(),
    workspace: {
      path: "C:\\repo",
      repositoryCheckedOut: true
    }
  };
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("/pulls?")) {
      return response(200, []);
    }

    return response(201, {
      number: 12,
      html_url: "https://github.com/acme/app/pull/12",
      title: "Fix #42: Fix login crash",
      body: "body",
      draft: true
    });
  };

  const pullRequest = await createGitHubPullRequest({
    config: {
      githubToken: "token",
      githubApiBaseUrl: "https://api.github.test",
      prDraft: true
    },
    workflow: targetWorkflow,
    fetchImpl,
    commandRunner: async (command, args, options) => {
      commandCalls.push({ command, args, options });
      return {
        command,
        args,
        cwd: options.cwd,
        exitCode: 0,
        stdout: "",
        stderr: ""
      };
    }
  });

  assert.deepEqual(commandCalls[0], {
    command: "git",
    args: ["push", "origin", "HEAD:refs/heads/ai/issue-42"],
    options: {
      cwd: "C:\\repo"
    }
  });
  assert.equal(pullRequest.push.exitCode, 0);
  assert.equal(calls.length, 2);
});
