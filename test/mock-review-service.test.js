import test from "node:test";
import assert from "node:assert/strict";
import { runMockReview } from "../src/review/mockReviewService.js";

function workflow(overrides = {}) {
  return {
    diff: {
      changedFiles: [
        {
          status: "M",
          path: "src/app.js"
        }
      ],
      truncated: false,
      ...overrides.diff
    },
    validation: {
      passed: true,
      ...overrides.validation
    }
  };
}

test("passes clean reviewed changes", async () => {
  const review = await runMockReview({
    workflow: workflow()
  });

  assert.equal(review.provider, "mock");
  assert.equal(review.passed, true);
  assert.equal(review.severity, "low");
  assert.deepEqual(review.findings, []);
});

test("adds a high severity finding when validation failed", async () => {
  const review = await runMockReview({
    workflow: workflow({
      validation: {
        passed: false
      }
    })
  });

  assert.equal(review.passed, false);
  assert.equal(review.severity, "high");
  assert.equal(review.findings[0].title, "Validation failed");
});

test("adds a finding when diff was truncated", async () => {
  const review = await runMockReview({
    workflow: workflow({
      diff: {
        truncated: true
      }
    })
  });

  assert.equal(review.passed, true);
  assert.equal(review.severity, "medium");
  assert.equal(review.findings[0].title, "Diff was truncated");
});

test("adds an informational finding when no files changed", async () => {
  const review = await runMockReview({
    workflow: workflow({
      diff: {
        changedFiles: []
      }
    })
  });

  assert.equal(review.passed, true);
  assert.equal(review.severity, "info");
  assert.equal(review.findings[0].title, "No changed files detected");
});
