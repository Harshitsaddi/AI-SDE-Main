import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

function createFileAuditLogger(filePath) {
  const resolvedPath = path.resolve(filePath);

  return (entry) => {
    mkdirSync(path.dirname(resolvedPath), { recursive: true });
    appendFileSync(resolvedPath, `${JSON.stringify(entry)}\n`, "utf8");
  };
}

export function createAuditLogger(config) {
  const provider = config.auditLogProvider || "none";

  if (provider === "none") {
    return null;
  }

  if (provider === "file") {
    return createFileAuditLogger(config.auditLogPath);
  }

  throw new Error(`Unsupported AUDIT_LOG_PROVIDER: ${provider}`);
}
