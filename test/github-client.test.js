import test from "node:test";
import assert from "node:assert/strict";
import { createGitHubClient, GitHubApiError } from "../src/github/client.js";

function response(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return headers[name.toLowerCase()] || null;
      }
    },
    text: async () => JSON.stringify(body)
  };
}

test("includes retry and rate-limit metadata on GitHub API errors", async () => {
  const client = createGitHubClient({
    token: "token",
    apiBaseUrl: "https://api.github.test",
    fetchImpl: async () => response(403, {
      message: "API rate limit exceeded"
    }, {
      "retry-after": "30",
      "x-ratelimit-limit": "5000",
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": "1710000000"
    })
  });

  await assert.rejects(
    () => client.getRef({
      owner: "acme",
      repo: "app",
      ref: "heads/main"
    }),
    (error) => {
      assert.equal(error instanceof GitHubApiError, true);
      assert.equal(error.status, 403);
      assert.equal(error.retryAfter, 30);
      assert.deepEqual(error.rateLimit, {
        limit: 5000,
        remaining: 0,
        resetEpochSeconds: 1710000000
      });
      return true;
    }
  );
});
