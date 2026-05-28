const DEFAULT_SECRET_PATTERNS = [
  "ghp_[A-Za-z0-9_]{20,}",
  "github_pat_[A-Za-z0-9_]+",
  "sk-[A-Za-z0-9_-]{20,}",
  "sk-ant-[A-Za-z0-9_-]{20,}",
  "AIza[0-9A-Za-z_-]{20,}",
  "-----BEGIN [A-Z ]*PRIVATE KEY-----[\\s\\S]*?-----END [A-Z ]*PRIVATE KEY-----"
];

function compilePattern(pattern) {
  try {
    return new RegExp(pattern, "g");
  } catch (error) {
    throw new Error(`Invalid secret redaction pattern: ${pattern}`);
  }
}

export function redactSecrets(value, patterns = []) {
  if (!value) {
    return value || "";
  }

  const regexes = [...DEFAULT_SECRET_PATTERNS, ...patterns].map(compilePattern);
  return regexes.reduce((current, regex) => current.replace(regex, "[REDACTED]"), String(value));
}
