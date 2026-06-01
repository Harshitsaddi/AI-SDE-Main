import test from "node:test";
import assert from "node:assert/strict";
import { runModelReview } from "../src/review/modelReviewService.js";
import { runReview } from "../src/review/reviewService.js";

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  };
}

function workflow() {
  return {
    id: "acme/app#issue-42",
    planningInput: {
      issue: {
        number: 42,
        title: "Fix login crash",
        body: "Login crashes without avatar."
      }
    },
    plan: {
      implementationPlan: ["Fix fallback."]
    },
    implementation: {
      summary: "Updated fallback."
    },
    diff: {
      diffStat: " src/auth.js | 2 ++",
      diff: "diff --git a/src/auth.js b/src/auth.js\n+return avatar || null;",
      changedFiles: [{ status: "M", path: "src/auth.js" }]
    },
    validation: {
      passed: true,
      results: [{ command: "npm test", status: "passed" }]
    }
  };
}

test("runs model review with OpenAI-compatible chat completions", async () => {
  const calls = [];
  const review = await runModelReview({
    config: {
      aiProvider: "openai",
      aiModel: "gpt-test",
      aiApiKey: "sk-test",
      secretRedactionPatterns: []
    },
    workflow: workflow(),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response(200, {
        choices: [
          {
            message: {
              content: JSON.stringify({
                passed: false,
                severity: "high",
                summary: "Potential null handling bug.",
                findings: [
                  {
                    severity: "high",
                    title: "Null fallback still unsafe",
                    body: "The fallback can still return null into a caller that expects a string.",
                    path: "src/auth.js",
                    line: 12
                  }
                ]
              })
            }
          }
        ]
      });
    }
  });

  assert.equal(calls[0].url, "https://api.openai.com/v1/chat/completions");
  assert.equal(JSON.parse(calls[0].options.body).model, "gpt-test");
  assert.equal(review.provider, "model:openai:gpt-test");
  assert.equal(review.passed, false);
  assert.equal(review.severity, "high");
  assert.equal(review.findings[0].path, "src/auth.js");
});

test("normalizes Gemini model review responses", async () => {
  const review = await runModelReview({
    config: {
      aiProvider: "gemini",
      aiModel: "gemini-test",
      aiApiKey: "AIza-test",
      secretRedactionPatterns: []
    },
    workflow: workflow(),
    fetchImpl: async () => response(200, {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  summary: "Looks good.",
                  findings: []
                })
              }
            ]
          }
        }
      ]
    })
  });

  assert.equal(review.provider, "model:gemini:gemini-test");
  assert.equal(review.passed, true);
  assert.equal(review.severity, "low");
  assert.deepEqual(review.findings, []);
});

test("dispatches model review from review service", async () => {
  const review = await runReview({
    config: {
      reviewProvider: "model",
      aiProvider: "openai",
      aiModel: "gpt-test",
      aiApiKey: "sk-test",
      secretRedactionPatterns: []
    },
    workflow: workflow(),
    fetchImpl: async () => response(200, {
      choices: [
        {
          message: {
            content: JSON.stringify({
              passed: true,
              severity: "low",
              summary: "No findings.",
              findings: []
            })
          }
        }
      ]
    })
  });

  assert.equal(review.passed, true);
  assert.equal(review.provider, "model:openai:gpt-test");
});

test("requires hosted AI provider for model review", async () => {
  await assert.rejects(
    () => runModelReview({
      config: {
        aiProvider: "mock",
        aiApiKey: "",
        secretRedactionPatterns: []
      },
      workflow: workflow(),
      fetchImpl: async () => {
        throw new Error("should not call provider");
      }
    }),
    /requires AI_PROVIDER/
  );
});
