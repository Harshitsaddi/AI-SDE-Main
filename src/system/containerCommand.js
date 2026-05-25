export function dockerRunArgs({
  image,
  workspacePath,
  containerWorkdir = "/workspace",
  extraArgs = [],
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
    ...extraArgs,
    image,
    command,
    ...args
  ];
}
