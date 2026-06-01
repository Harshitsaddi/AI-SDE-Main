import test from "node:test";
import assert from "node:assert/strict";
import { collectCiStatus } from "../src/ci/ciStatusService.js";

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  };
}

function workflow() {
  return {
    planningInput: {
      repository: {
        fullName: "acme/app"
      }
    },
    branch: {
      branchName: "ai/issue-42"
    }
  };
}

test("collects passing GitHub check runs", async () => {
  const calls = [];
  const ci = await collectCiStatus({
    config: {
      ciProvider: "github",
      githubToken: "token",
      githubApiBaseUrl: "https://api.github.test"
    },
    workflow: workflow(),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response(200, {
        total_count: 2,
        check_runs: [
          {
            name: "test",
            status: "completed",
            conclusion: "success",
            html_url: "https://github.test/checks/1"
          },
          {
            name: "lint",
            status: "completed",
            conclusion: "neutral",
            html_url: "https://github.test/checks/2"
          }
        ]
      });
    }
  });

  assert.equal(calls[0].url, "https://api.github.test/repos/acme/app/commits/ai%2Fissue-42/check-runs");
  assert.equal(ci.passed, true);
  assert.equal(ci.status, "passed");
  assert.equal(ci.total, 2);
  assert.equal(ci.failedCount, 0);
});

test("collects pending and failed GitHub check runs", async () => {
  const ci = await collectCiStatus({
    config: {
      ciProvider: "github",
      githubToken: "token",
      githubApiBaseUrl: "https://api.github.test"
    },
    workflow: workflow(),
    fetchImpl: async () => response(200, {
      total_count: 2,
      check_runs: [
        {
          name: "test",
          status: "completed",
          conclusion: "failure"
        },
        {
          name: "deploy",
          status: "in_progress",
          conclusion: null
        }
      ]
    })
  });

  assert.equal(ci.passed, false);
  assert.equal(ci.status, "pending");
  assert.equal(ci.failedCount, 1);
  assert.equal(ci.pendingCount, 1);
});
