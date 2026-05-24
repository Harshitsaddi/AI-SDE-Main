export function validationCommandsForWorkflow(workflow) {
  const implementationCommands = workflow.implementation?.validationCommands || [];
  const inspectionCommands = workflow.repositoryInspection?.validationCommands || [];
  const planCommands = workflow.plan?.validationCommands || [];

  return [...new Set([
    ...implementationCommands,
    ...inspectionCommands,
    ...planCommands
  ])].filter(Boolean);
}
