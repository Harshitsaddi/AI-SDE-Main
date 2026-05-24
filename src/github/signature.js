import crypto from "node:crypto";

export function signPayload(secret, rawBody) {
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return `sha256=${digest}`;
}

export function verifyGitHubSignature({ secret, rawBody, signature }) {
  if (!secret) {
    return { ok: false, reason: "missing_webhook_secret" };
  }

  if (!signature || !signature.startsWith("sha256=")) {
    return { ok: false, reason: "missing_or_invalid_signature" };
  }

  const expected = signPayload(secret, rawBody);
  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (signatureBuffer.length !== expectedBuffer.length) {
    return { ok: false, reason: "signature_length_mismatch" };
  }

  const ok = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  return ok ? { ok: true } : { ok: false, reason: "signature_mismatch" };
}
