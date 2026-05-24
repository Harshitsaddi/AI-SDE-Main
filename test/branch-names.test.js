import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeBranchName } from "../src/branches/branchNames.js";

test("keeps a normal generated branch name", () => {
  assert.equal(sanitizeBranchName("ai/issue-42"), "ai/issue-42");
});

test("sanitizes spaces and invalid ref characters", () => {
  assert.equal(sanitizeBranchName(" ai/fix login?: crash "), "ai/fix-login-crash");
});

test("avoids lock suffix refs", () => {
  assert.equal(sanitizeBranchName("ai/fix.lock"), "ai/fix-lock");
});
