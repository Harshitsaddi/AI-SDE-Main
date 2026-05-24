export function splitRepositoryFullName(fullName) {
  const [owner, repo] = (fullName || "").split("/");

  if (!owner || !repo) {
    throw new Error(`Invalid repository full name: ${fullName}`);
  }

  return { owner, repo };
}
