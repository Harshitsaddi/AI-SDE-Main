export async function createMockIssueComment({ body, workflow }) {
  return {
    provider: "mock",
    created: false,
    issueNumber: workflow.planningInput.issue.number,
    body,
    url: `${workflow.planningInput.issue.url}#mock-ai-comment`
  };
}
