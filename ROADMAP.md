# AI SDE Workflow Roadmap

## Progress

Approximate MVP completion: **80%**.

Built: issue intake, planning, human approval, branch creation, workspace checkout, repository inspection, mock implementation, diff capture, validation collection, AI review, PR creation, and a small dashboard.

Remaining MVP-critical work: production-grade GitHub App authentication and a real code-editing provider.

## Done

- Created a Node.js MVP service using only built-in runtime modules.
- Added GitHub issue webhook intake at `POST /webhooks/github`.
- Added GitHub webhook signature verification with `X-Hub-Signature-256`.
- Added issue action filtering for `opened`, `reopened`, and `edited`.
- Added issue and repository metadata extraction for planning.
- Added a repository context builder stub for the first metadata-only planning slice.
- Added a mock AI planner that produces deterministic implementation plans.
- Added in-memory workflow storage.
- Added `awaiting_approval` workflow state after plan generation.
- Added workflow listing and detail endpoints.
- Added human approval endpoint at `POST /workflows/:id/approve`.
- Added human rejection endpoint at `POST /workflows/:id/reject`.
- Added branch creation after approval through a provider abstraction.
- Added mock branch provider for local MVP flow.
- Added token-based GitHub branch provider for MVP integration.
- Added branch success and failure workflow states.
- Added workspace preparation after branch creation.
- Added mock workspace provider that creates per-workflow metadata.
- Added git workspace provider for local repository checkout.
- Added workspace success and failure workflow states.
- Added local repository inspection after workspace preparation.
- Added file tree scanning with dependency/build directory exclusions.
- Added important file reading for README, package, and config files.
- Added stack detection and validation command suggestions.
- Added issue keyword search across small text files.
- Added repository inspection success and failure workflow states.
- Added a lightweight local workflow dashboard at `GET /`.
- Added implementation-agent provider interface.
- Added mock implementation provider that records planned changes without editing code.
- Added implementation success and failure workflow states.
- Added git diff capture after implementation.
- Added diff success and failure workflow states.
- Added validation provider interface.
- Added mock validation provider for safe default command collection.
- Added local validation provider for opt-in workspace command execution.
- Added validation success and failure workflow states.
- Added review provider interface.
- Added mock AI review pass for diff and validation metadata.
- Added review success and failure workflow states.
- Added pull request provider interface.
- Added mock pull request artifact generation.
- Added token-based GitHub pull request creation.
- Added pull request success and failure workflow states.
- Added durable file-backed workflow persistence.
- Added `.gitignore` entries for local runtime output and secrets.
- Added tests for webhook signature validation.
- Added tests for issue webhook workflow creation.
- Added tests for approval and rejection transitions.
- Added tests for branch creation after approval.
- Added tests for GitHub branch API calls and idempotent existing-branch handling.
- Added tests for workspace naming and mock workspace metadata.
- Added tests for fresh git checkout, existing workspace refresh, and missing clone URL handling.
- Added tests for repository inspection, validation command detection, skipped inspection, and dashboard serving.
- Added tests for mock implementation output and implementation failure handling.
- Added tests for clean diff capture, changed-file parsing, diff truncation, and diff failure routing.
- Added tests for validation command parsing, mock validation, local validation pass/fail collection, and no-command handling.
- Added tests for mock review findings and review failure routing.
- Added tests for pull request body generation, mock PR output, GitHub PR API calls, and PR failure routing.
- Added tests for workflow persistence reloads, memory store mode, and unsupported store config.
- Added local run and endpoint documentation.

## Next In Order

1. Add SQLite or PostgreSQL persistence upgrade for indexed workflow querying.
2. Add failure retry controls for branch, workspace, implementation, diff, validation, review, and PR stages.
3. Add dashboard detail views for plan, inspection, implementation, diff, validation, review, and PR output.
4. Add GitHub issue comments for plan publishing and workflow status updates.
5. Add `/ai approve` and `/ai reject` comment command support.
6. Add configurable per-repository validation command overrides.
7. Add first real implementation provider, such as Aider, Claude Code, or an OpenAI tool-calling agent.
8. Add GitHub App authentication and replace token-based branch/PR providers.
9. Add audit log persistence for prompts, decisions, commands, outputs, diffs, and review results.
10. Add sandboxed validation execution using containers.
11. Add container isolation for implementation worker jobs.
12. Add secret handling and policy controls.
13. Add multi-repository configuration.
14. Add provider abstraction for multiple model vendors.
15. Add production deployment configuration.
