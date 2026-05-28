export function dockerRunArgs({
  image,
  workspacePath,
  containerWorkdir = "/workspace",
  extraArgs = [],
  envKeys = [],
  command,
  args = []
}) {
  if (!image) {
    throw new Error("Container image is required");
  }

  if (!workspacePath) {
    throw new Error("Workspace path is required for container execution");
  }

  return [
    "run",
    "--rm",
    "-v",
    `${workspacePath}:${containerWorkdir}`,
    "-w",
    containerWorkdir,
    ...envKeys.flatMap((key) => ["-e", key]),
    ...extraArgs,
    image,
    command,
    ...args
  ];
}
