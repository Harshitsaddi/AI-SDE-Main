import crypto from "node:crypto";
import { createGitHubClient, GitHubApiError } from "./client.js";

function base64Url(value) {
  return Buffer.from(JSON.stringify(value))
    .toString("base64url");
}

function requireConfigValue(value, name) {
  if (!value) {
    throw new Error(`${name} is required for GitHub App authentication`);
  }
}

export function createGitHubAppJwt({ appId, privateKey, now = Date.now }) {
  requireConfigValue(appId, "GITHUB_APP_ID");
  requireConfigValue(privateKey, "GITHUB_APP_PRIVATE_KEY");

  const issuedAt = Math.floor(now() / 1000) - 60;
  const expiresAt = issuedAt + 9 * 60;
  const encodedHeader = base64Url({ alg: "RS256", typ: "JWT" });
  const encodedPayload = base64Url({
    iat: issuedAt,
    exp: expiresAt,
    iss: appId
  });
  const input = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(input)
    .end()
    .sign(privateKey, "base64url");

  return `${input}.${signature}`;
}

export async function createGitHubInstallationToken({ config, fetchImpl = fetch }) {
  requireConfigValue(config.githubAppInstallationId, "GITHUB_APP_INSTALLATION_ID");

  const jwt = createGitHubAppJwt({
    appId: config.githubAppId,
    privateKey: config.githubAppPrivateKey
  });
  const response = await fetchImpl(
    `${config.githubApiBaseUrl}/app/installations/${config.githubAppInstallationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${jwt}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28"
      }
    }
  );
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new GitHubApiError(`GitHub App installation token request failed with status ${response.status}`, {
      status: response.status,
      body
    });
  }

  if (!body?.token) {
    throw new Error("GitHub App installation token response did not include a token");
  }

  return body.token;
}

export async function githubTokenForConfig({ config, fetchImpl = fetch }) {
  const provider = config.githubAuthProvider || "token";

  if (provider === "token") {
    return config.githubToken;
  }

  if (provider === "app") {
    return createGitHubInstallationToken({ config, fetchImpl });
  }

  throw new Error(`Unsupported GITHUB_AUTH_PROVIDER: ${provider}`);
}

export async function createGitHubClientFromConfig({ config, fetchImpl = fetch }) {
  return createGitHubClient({
    token: await githubTokenForConfig({ config, fetchImpl }),
    apiBaseUrl: config.githubApiBaseUrl,
    fetchImpl
  });
}
