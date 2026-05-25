import test from "node:test";
import assert from "node:assert/strict";
import { redactSecrets } from "../src/system/redaction.js";

test("redacts common token patterns", () => {
  const redacted = redactSecrets("token=ghp_abcdefghijklmnopqrstuvwxyz123456");

  assert.equal(redacted, "token=[REDACTED]");
});

test("redacts custom secret patterns", () => {
  const redacted = redactSecrets("internal secret is tenant-secret-123", ["tenant-secret-[0-9]+"]);

  assert.equal(redacted, "internal secret is [REDACTED]");
});
