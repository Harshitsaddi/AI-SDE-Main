import { inspectLocalRepository } from "./repositoryInspector.js";

export async function inspectRepository({ config, workflow }) {
  if (config.inspectionProvider === "local") {
    return inspectLocalRepository({ config, workflow });
  }

  throw new Error(`Unsupported INSPECTION_PROVIDER: ${config.inspectionProvider}`);
}
