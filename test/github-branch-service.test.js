import test from "node:test";
import assert from "node:assert/strict";
import { createGitHubBranch } from "../src/branches/githubBranchService.js";

function workflow() {
  return {
    plan: {
      proposedBranchName: "ai/issue-42"
    },
    planningInput: {
      repository: {
        fullName: "acme/app",
        defaultBranch: "main",
        htmlUrl: "https://github.com/acme/app"
      }
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

test("creates a GitHub branch from the default branch SHA", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });

    if (url.endsWith("/repos/acme/app/git/ref/heads%2Fmain")) {
      return response(200, {
        object: {
          sha: "abc123"
        }
      });
    }

    if (url.endsWith("/repos/acme/app/git/refs")) {
      return response(201, {
        ref: "refs/heads/ai/issue-42"
      });
    }

    throw new Error(`Unexpected URL: ${url}`);
  };

  const branch = await createGitHubBranch({
    config: {
      githubToken: "token",
      githubApiBaseUrl: "https://api.github.test"
    },
    workflow: workflow(),
    fetchImpl
  });

  assert.equal(branch.provider, "github_token");
  assert.equal(branch.branchName, "ai/issue-42");
  assert.equal(branch.created, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    ref: "refs/heads/ai/issue-42",
    sha: "abc123"
  });
});

test("treats an existing GitHub branch as idempotent success", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/repos/acme/app/git/ref/heads%2Fmain")) {
      return response(200, {
        object: {
          sha: "abc123"
        }
      });
    }

    return response(422, {
      message: "Reference already exists"
    });
  };

  const branch = await createGitHubBranch({
    config: {
      githubToken: "token",
      githubApiBaseUrl: "https://api.github.test"
    },
    workflow: workflow(),
    fetchImpl
  });

  assert.equal(branch.created, false);
  assert.equal(branch.alreadyExists, true);
});

test("requires a GitHub token for token branch provider", async () => {
  await assert.rejects(
    createGitHubBranch({
      config: {
        githubToken: "",
        githubApiBaseUrl: "https://api.github.test"
      },
      workflow: workflow(),
      fetchImpl: async () => response(200, {})
    }),
    /GITHUB_TOKEN is required/
  );
});
