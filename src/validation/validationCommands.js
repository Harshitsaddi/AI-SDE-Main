export function validationCommandsForWorkflow(workflow, config = {}) {
  const repositoryName = workflow.planningInput?.repository?.fullName;
  const overrideCommands = repositoryName
    ? config.validationCommandOverrides?.[repositoryName] || config.validationCommandOverrides?.["*"]
    : config.validationCommandOverrides?.["*"];

  if (overrideCommands) {
    return [...new Set(overrideCommands)].filter(Boolean);
  }

  const implementationCommands = workflow.implementation?.validationCommands || [];
  const inspectionCommands = workflow.repositoryInspection?.validationCommands || [];
  const planCommands = workflow.plan?.validationCommands || [];

  return [...new Set([
    ...implementationCommands,
    ...inspectionCommands,
    ...planCommands
  ])].filter(Boolean);
}
