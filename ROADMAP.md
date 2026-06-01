# AI SDE Workflow Roadmap

## Progress

Approximate MVP completion: **100%**.

Built: issue intake, mock and command planning providers, human approval, branch creation, workspace checkout, repository inspection, mock and command implementation providers, diff capture, local/container validation collection, AI review, PR creation, GitHub issue comment commands, audit logging, and a small dashboard.

Remaining production hardening work: deeper production hardening.

## Done

- Created a Node.js MVP service using only built-in runtime modules.
- Added GitHub issue webhook intake at `POST /webhooks/github`.
- Added GitHub webhook signature verification with `X-Hub-Signature-256`.
- Added issue action filtering so only `opened` creates a plan; edits are ignored to avoid duplicate workflows.
- Added issue and repository metadata extraction for planning.
- Added a repository context builder stub for the first metadata-only planning slice.
- Added a mock AI planner that produces deterministic implementation plans.
- Added command-based AI planner provider for external planning/model tools.
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
- Added repository instruction ingestion for `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md`.
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
- Added container validation provider for Docker-isolated validation execution.
- Added validation success and failure workflow states.
- Added review provider interface.
- Added mock AI review pass for diff and validation metadata.
- Added model-backed AI review provider for hosted OpenAI, Anthropic, and Gemini review findings.
- Added review success and failure workflow states.
- Added pull request provider interface.
- Added mock pull request artifact generation.
- Added token-based GitHub pull request creation.
- Added open pull request reuse for an existing workflow branch to avoid duplicate PRs on retry.
- Added pull request success and failure workflow states.
- Added optional GitHub CI check-run collection after pull request creation.
- Added durable file-backed workflow persistence.
- Added SQLite workflow persistence with indexed status, repository, issue number, and updated time columns.
- Added retry controls for failed branch, workspace, inspection, implementation, diff, validation, review, and PR stages.
- Added dashboard detail views for workflow plan, inspection, implementation, diff, validation, review, and PR output.
- Added configurable per-repository validation command overrides.
- Added GitHub issue comment publishing for plans and workflow status updates.
- Added `/ai approve` and `/ai reject` issue comment command support.
- Added GitHub App installation token authentication for GitHub API providers.
- Added append-only JSONL audit logging for workflow lifecycle events.
- Added command-based implementation provider for local coding agents.
- Added dashboard API bearer-token protection with `DASHBOARD_TOKEN`.
- Added dashboard/provider readiness checks for common configuration mistakes.
- Added in-process workflow execution locking for duplicate approval/retry protection.
- Added optional async workflow execution mode for quick approval/retry responses.
- Added optional Docker wrapper for command-based implementation.
- Added Dockerfile, Compose packaging, and deployment notes.
- Added configurable command allowlists for implementation and local validation.
- Added secret redaction for persisted implementation and validation command output.
- Added multi-repository configuration overrides.
- Added `.gitignore` entries for local runtime output and secrets.
- Added tests for webhook signature validation.
- Added tests for issue webhook workflow creation.
- Added tests for approval and rejection transitions.
- Added tests for branch creation after approval.
- Added tests for GitHub branch API calls and idempotent existing-branch handling.
- Added tests for workspace naming and mock workspace metadata.
- Added tests for fresh git checkout, existing workspace refresh, and missing clone URL handling.
- Added tests for repository inspection, repository instruction ingestion, validation command detection, skipped inspection, and dashboard serving.
- Added tests for mock implementation output and implementation failure handling.
- Added tests for clean diff capture, changed-file parsing, diff truncation, and diff failure routing.
- Added tests for validation command parsing, mock validation, local validation pass/fail collection, and no-command handling.
- Added tests for mock review findings, model review normalization, and review failure routing.
- Added tests for pull request body generation, mock PR output, GitHub PR API calls, PR failure routing, and CI status collection.
- Added tests for workflow persistence reloads, SQLite persistence/indexes, memory store mode, and unsupported store config.
- Added tests for retry event recording and resuming a failed workflow stage.
- Added tests for validation command overrides.
- Added tests for issue comment publishing and comment-command approval/rejection.
- Added tests for GitHub App JWT signing and installation token exchange.
- Added tests for file-backed audit log entries.
- Added tests for command implementation prompt creation and command execution.
- Added tests for command allowlist policy enforcement.
- Added tests for default and custom secret redaction.
- Added tests for repository-specific config merging.
- Added tests for command planner output parsing and policy enforcement.
- Added tests for container validation and implementation Docker wrapping.
- Added tests for dashboard API auth, provider readiness checks, concurrent retry protection, async workflow execution, and existing PR reuse.
- Added local run and endpoint documentation.

## Next In Order

1. Add deeper production hardening for multi-process queues, retries with backoff, rate-limit handling, and observability.
