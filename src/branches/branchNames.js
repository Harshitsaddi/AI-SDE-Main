export function sanitizeBranchName(value) {
  const fallback = "ai/change";
  const text = String(value || fallback)
    .trim()
    .replace(/\\/g, "/")
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._/-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/\.+/g, ".")
    .replace(/^[./-]+|[./-]+$/g, "")
    .replace(/\/[./-]+/g, "/")
    .replace(/[./-]+\//g, "/");

  const sanitized = text || fallback;

  if (sanitized.endsWith(".lock")) {
    return `${sanitized.slice(0, -5)}-lock`;
  }

  return sanitized;
}
