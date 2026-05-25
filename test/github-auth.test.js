import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createGitHubAppJwt, githubTokenForConfig } from "../src/github/auth.js";

function keyPair() {
  return crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem"
    },
    publicKeyEncoding: {
      type: "spki",
      format: "pem"
    }
  });
}

test("creates a signed GitHub App JWT", () => {
  const { privateKey, publicKey } = keyPair();
  const token = createGitHubAppJwt({
    appId: "12345",
    privateKey,
    now: () => 1_700_000_000_000
  });
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  const verified = crypto
    .createVerify("RSA-SHA256")
    .update(`${encodedHeader}.${encodedPayload}`)
    .end()
    .verify(publicKey, encodedSignature, "base64url");

  assert.equal(header.alg, "RS256");
  assert.equal(payload.iss, "12345");
  assert.equal(payload.exp - payload.iat, 540);
  assert.equal(verified, true);
});

test("exchanges a GitHub App JWT for an installation token", async () => {
  const { privateKey } = keyPair();
  const calls = [];
  const token = await githubTokenForConfig({
    config: {
      githubAuthProvider: "app",
      githubApiBaseUrl: "https://api.github.test",
      githubAppId: "12345",
      githubAppPrivateKey: privateKey,
      githubAppInstallationId: "67890"
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ token: "installation-token" }), {
        status: 201,
        headers: {
          "content-type": "application/json"
        }
      });
    }
  });

  assert.equal(token, "installation-token");
  assert.equal(calls[0].url, "https://api.github.test/app/installations/67890/access_tokens");
  assert.equal(calls[0].options.method, "POST");
  assert.match(calls[0].options.headers.authorization, /^Bearer .+\..+\..+$/);
});

test("uses configured token auth unchanged", async () => {
  const token = await githubTokenForConfig({
    config: {
      githubAuthProvider: "token",
      githubToken: "fine-grained-token"
    },
    fetchImpl: async () => {
      throw new Error("should not request an installation token");
    }
  });

  assert.equal(token, "fine-grained-token");
});
