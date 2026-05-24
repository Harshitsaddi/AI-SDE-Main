import test from "node:test";
import assert from "node:assert/strict";
import { signPayload, verifyGitHubSignature } from "../src/github/signature.js";

test("verifies a valid GitHub signature", () => {
  const rawBody = Buffer.from(JSON.stringify({ action: "opened" }));
  const signature = signPayload("secret", rawBody);

  assert.equal(
    verifyGitHubSignature({ secret: "secret", rawBody, signature }).ok,
    true
  );
});

test("rejects an invalid GitHub signature", () => {
  const rawBody = Buffer.from(JSON.stringify({ action: "opened" }));

  assert.equal(
    verifyGitHubSignature({ secret: "secret", rawBody, signature: "sha256=bad" }).ok,
    false
  );
});
