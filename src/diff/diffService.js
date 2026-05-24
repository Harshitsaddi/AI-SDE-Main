import { captureGitDiff } from "./gitDiffService.js";

export async function captureDiff({ config, workflow, commandRunner }) {
  if (config.diffProvider === "git") {
    return captureGitDiff({ config, workflow, commandRunner });
  }

  throw new Error(`Unsupported DIFF_PROVIDER: ${config.diffProvider}`);
}
