import test from "node:test";
import assert from "node:assert/strict";
import { WorkflowStore } from "../src/workflows/store.js";

function createWorkflow(store = new WorkflowStore()) {
  return store.createFromPlan({
    planningInput: {
      repository: {
        fullName: "acme/app"
      },
      issue: {
        id: 10,
        number: 42
      }
    },
    plan: {
      provider: "mock"
    }
  });
}

test("approves an awaiting workflow", () => {
  const store = new WorkflowStore();
  const workflow = createWorkflow(store);

  const result = store.approve(workflow.id, {
    reviewer: "sam",
    comment: "Looks good."
  });

  assert.equal(result.ok, true);
  assert.equal(result.workflow.status, "approved");
  assert.equal(result.workflow.approvals[0].decision, "approved");
  assert.equal(result.workflow.events.at(-1).type, "plan_approved");
});

test("rejects an awaiting workflow", () => {
  const store = new WorkflowStore();
  const workflow = createWorkflow(store);

  const result = store.reject(workflow.id, {
    reviewer: "sam",
    comment: "Needs a smaller scope."
  });

  assert.equal(result.ok, true);
  assert.equal(result.workflow.status, "plan_rejected");
  assert.equal(result.workflow.approvals[0].decision, "rejected");
  assert.equal(result.workflow.events.at(-1).type, "plan_rejected");
});

test("does not approve a workflow twice", () => {
  const store = new WorkflowStore();
  const workflow = createWorkflow(store);

  store.approve(workflow.id, { reviewer: "sam" });
  const result = store.approve(workflow.id, { reviewer: "sam" });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "workflow_not_awaiting_approval");
});

test("records retry requests for failed workflows", () => {
  const store = new WorkflowStore();
  const workflow = createWorkflow(store);

  store.markValidationFailed(workflow.id, new Error("Validation runner crashed"));
  const result = store.requestRetry(workflow.id, {
    reviewer: "sam",
    comment: "Runner is back online."
  });

  assert.equal(result.ok, true);
  assert.equal(result.stage, "validation");
  assert.equal(result.workflow.retries[0].reviewer, "sam");
  assert.equal(result.workflow.events.at(-1).type, "retry_requested");
});

test("does not retry non-failed workflows", () => {
  const store = new WorkflowStore();
  const workflow = createWorkflow(store);

  const result = store.requestRetry(workflow.id, { reviewer: "sam" });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "workflow_not_retryable");
});
