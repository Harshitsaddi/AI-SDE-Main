import { existsSync, readFileSync } from "node:fs";

function cleanValue(value) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\""))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export function loadEnvFile(filePath = ".env", env = process.env) {
  if (!existsSync(filePath)) {
    return env;
  }

  const content = readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    if (!key || env[key] !== undefined) {
      continue;
    }

    env[key] = cleanValue(trimmed.slice(separator + 1));
  }

  return env;
}
