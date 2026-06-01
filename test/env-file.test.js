import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadEnvFile } from "../src/config/envFile.js";

test("loads simple .env files without overriding existing environment values", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-sde-env-"));
  const envPath = path.join(root, ".env");
  const env = {
    PORT: "4000"
  };

  await writeFile(envPath, [
    "PORT=3000",
    "GITHUB_WEBHOOK_SECRET=\"secret value\"",
    "AI_PROVIDER=gemini",
    "# ignored comment"
  ].join("\n"), "utf8");

  loadEnvFile(envPath, env);

  assert.equal(env.PORT, "4000");
  assert.equal(env.GITHUB_WEBHOOK_SECRET, "secret value");
  assert.equal(env.AI_PROVIDER, "gemini");
});
