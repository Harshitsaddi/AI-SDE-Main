# AI SDE Workflow MVP

This repository starts the first slice of an AI-assisted software engineering workflow platform:

1. Receive a GitHub issue webhook.
2. Validate the webhook signature.
3. Extract issue and repository context.
4. Generate a structured implementation plan.
5. Store the workflow in an approval-ready state.

The implementation uses Node.js built-ins and targets Node 24+, including the built-in SQLite module used by the default workflow store.

## Run

Use Node.js 24 or newer:

```bash
node --version
```

```bash
npm start
```

Default URL:

```text
http://localhost:3000
```

Docker Compose:

```bash
cp .env.example .env
docker compose up --build
```

## Environment

Copy `.env.example` into your shell environment and set:

```text
PORT=3000
DASHBOARD_TOKEN=
GITHUB_WEBHOOK_SECRET=...
AI_PROVIDER=mock
AI_MODEL=
AI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
AI_SETTINGS_PATH=var/data/ai-settings.json
AI_COMMAND=
AI_COMMAND_ALLOWLIST=
AI_COMMAND_TIMEOUT_MS=120000
AI_COMMAND_WORK_DIR=var/ai
BRANCH_PROVIDER=mock
GITHUB_AUTH_PROVIDER=token
GITHUB_TOKEN=
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_APP_INSTALLATION_ID=
GITHUB_API_BASE_URL=https://api.github.com
WORKSPACE_PROVIDER=mock
WORKSPACE_ROOT=var/workspaces
INSPECTION_PROVIDER=local
INSPECTION_MAX_FILES=500
IMPLEMENTATION_PROVIDER=mock
IMPLEMENTATION_COMMAND=
IMPLEMENTATION_COMMAND_ALLOWLIST=
IMPLEMENTATION_COMMAND_TIMEOUT_MS=600000
IMPLEMENTATION_CONTAINER_IMAGE=
IMPLEMENTATION_CONTAINER_WORKDIR=/workspace
IMPLEMENTATION_CONTAINER_EXTRA_ARGS=
VALIDATION_PROVIDER=mock
VALIDATION_COMMAND_TIMEOUT_MS=120000
VALIDATION_COMMAND_ALLOWLIST=
VALIDATION_CONTAINER_IMAGE=
VALIDATION_CONTAINER_WORKDIR=/workspace
VALIDATION_CONTAINER_EXTRA_ARGS=
VALIDATION_COMMAND_OVERRIDES=
DIFF_PROVIDER=git
DIFF_MAX_BYTES=200000
REVIEW_PROVIDER=mock
PR_PROVIDER=mock
PR_DRAFT=true
CI_PROVIDER=none
ISSUE_COMMENT_PROVIDER=none
AUDIT_LOG_PROVIDER=none
AUDIT_LOG_PATH=var/audit/workflow-audit.jsonl
WORKFLOW_EXECUTION_MODE=sync
SECRET_REDACTION_PATTERNS=
REPOSITORY_CONFIG=
WORKFLOW_STORE_PROVIDER=sqlite
WORKFLOW_STORE_PATH=var/data/workflows.sqlite
```

`DASHBOARD_TOKEN` protects the dashboard APIs when set. Use a long random value before exposing the app through a tunnel; the browser dashboard will ask for it and store it in local storage.

`AI_PROVIDER=mock` returns a deterministic plan and is useful while wiring GitHub and approval UX.

The dashboard includes readiness checks plus AI settings for selecting `mock`, `command`, `openai`, `anthropic`, or `gemini`, setting a model, and saving an API key locally. Saved keys are stored at `AI_SETTINGS_PATH` and are not returned to the browser. New workflows use the latest saved dashboard settings. You can also set `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, or provider-specific keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) from the environment.

Set `AI_PROVIDER=command` to call an external planning tool. `AI_COMMAND` is parsed without a shell and may use `{inputPath}`, `{promptPath}`, `{outputPath}`, `{repository}`, and `{issueNumber}` placeholders. The provider writes planning input and prompt files under `AI_COMMAND_WORK_DIR`; the command can either print a plan JSON document to stdout or write it to `{outputPath}`. Use `AI_COMMAND_ALLOWLIST` to restrict allowed command prefixes.

```text
AI_PROVIDER=command
AI_COMMAND=my-planner --input {inputPath} --output {outputPath}
AI_COMMAND_ALLOWLIST=["my-planner"]
```

`BRANCH_PROVIDER=mock` records branch creation without calling GitHub. For a token-based MVP bridge, set `BRANCH_PROVIDER=github_token` and provide a fine-grained GitHub token with repository contents write access.

GitHub API providers use `GITHUB_AUTH_PROVIDER=token` by default. Set `GITHUB_AUTH_PROVIDER=app`, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_APP_INSTALLATION_ID` to exchange a GitHub App JWT for an installation token before branch, issue comment, and pull request API calls. Private keys can use escaped newlines in environment variables.

## Endpoints

### `GET /`

Shows a local workflow dashboard with refresh, approval, rejection, and retry actions.

### `GET /health`

Returns service status.

### `GET /health/providers`

Returns dashboard readiness checks for GitHub auth, AI planner config, implementation provider, validation provider, execution mode, and workflow persistence. This endpoint requires `Authorization: Bearer <DASHBOARD_TOKEN>` when `DASHBOARD_TOKEN` is configured.

### `GET /settings/ai`

Returns the active AI planner provider, selected model, supported dashboard options, and whether an API key is configured for each hosted model provider.

### `PUT /settings/ai`

Updates dashboard AI settings. The request can include `provider`, `model`, `apiKey`, and `clearApiKey`. API keys are saved server-side and are never included in the response.

Dashboard API endpoints require `Authorization: Bearer <DASHBOARD_TOKEN>` when `DASHBOARD_TOKEN` is configured. `/health` and `/webhooks/github` do not use this token; webhooks are protected by `GITHUB_WEBHOOK_SECRET`.

### `POST /webhooks/github`

Accepts GitHub `issues` and `issue_comment` events. For MVP, only `opened` issue actions create an implementation plan; issue edits are ignored to avoid duplicate workflows. `issue_comment` `created` events can approve or reject a workflow when the comment body is `/ai approve` or `/ai reject`.

Required headers:

```text
X-GitHub-Event: issues
X-Hub-Signature-256: sha256=...
```

### `GET /workflows`

Lists stored workflows.

### `GET /workflows/:id`

Returns a single workflow.

### `POST /workflows/:id/retry`

Retries a workflow that failed during branch creation, workspace preparation, repository inspection, implementation, diff capture, validation, review, or pull request creation. The retry resumes from the failed stage and continues through the remaining stages.

## Test

```bash
npm test
```

## Deployment Notes

The included `Dockerfile` runs the service with Node 24 Alpine so the default SQLite workflow store is available. `compose.yaml` mounts `/app/var` for workflow data, audit logs, and workspaces. For Git-backed workspaces, make sure the container has network access and credentials for private repositories. For Docker-isolated validation or implementation from inside the service container, mount the host Docker socket intentionally and restrict command allowlists.

## Current MVP Boundary

This slice stops after human approval, branch creation, workspace preparation, repository inspection, mock implementation, diff capture, and validation collection. Branch creation supports a local mock provider and a token-based GitHub provider. Workspace preparation supports a mock local provider and a `git` provider that checks out the generated branch under `WORKSPACE_ROOT`.

For real local checkout, set:

```text
WORKSPACE_PROVIDER=git
```

The `git` provider expects the repository `clone_url` from the GitHub webhook to be accessible by the local `git` command. For private repositories, configure credentials outside the app, such as Git Credential Manager or an environment-specific credential helper.

Repository inspection runs after workspace preparation. The local inspector scans checked-out workspaces, skips common dependency/build folders, reads important files, detects stack hints, suggests validation commands, and searches for issue-related terms.

Repository inspection also captures agent instruction files when present: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md`. These instructions are included in the implementation prompt for command agents.

`IMPLEMENTATION_PROVIDER=mock` records the implementation plan, candidate files, and validation commands without changing code. It is the adapter seam for a real coding agent provider.

Set `IMPLEMENTATION_PROVIDER=command` to run a local implementation agent in the prepared workspace. `IMPLEMENTATION_COMMAND` is parsed without a shell and may use `{promptPath}`, `{workspacePath}`, and `{workflowId}` placeholders. The provider writes `.ai-sde/implementation-prompt.md` before invoking the command and also exposes `AI_SDE_IMPLEMENTATION_PROMPT`, `AI_SDE_WORKSPACE`, `AI_SDE_WORKFLOW_ID`, `AI_SDE_AI_PROVIDER`, `AI_SDE_AI_MODEL`, and `AI_SDE_AI_API_KEY` environment variables.

For Aider specifically, a noninteractive invocation like `aider --yes --no-gitignore --model {aiModel} --message-file {promptPath}` is usually the safest starting point.

When the dashboard provider is Gemini and the model is `gemini-...`, `{aiModel}` is passed to Aider as `gemini/gemini-...` so Aider uses the AI Studio `GEMINI_API_KEY` path instead of Vertex AI credentials.

The implementation prompt uses the issue title/body and local repository files; it does not include the GitHub issue URL, which prevents command agents from wasting time scraping a private or unavailable GitHub page. If the command agent asks for clarification instead of editing files, the workflow stops as `needs_clarification`.

Set `IMPLEMENTATION_COMMAND_ALLOWLIST` to a JSON array of allowed command prefixes to restrict command implementation execution:

Example:

```text
IMPLEMENTATION_PROVIDER=command
IMPLEMENTATION_COMMAND=aider --yes --no-gitignore --model {aiModel} --message-file {promptPath}
IMPLEMENTATION_COMMAND_ALLOWLIST=["aider"]
```

Set `IMPLEMENTATION_CONTAINER_IMAGE` to run the command implementation provider inside Docker. The workspace is mounted at `IMPLEMENTATION_CONTAINER_WORKDIR`, and `IMPLEMENTATION_CONTAINER_EXTRA_ARGS` can pass a JSON array of additional `docker run` arguments.

`DIFF_PROVIDER=git` captures changed files and a bounded diff from the workspace after implementation.

If a real implementation agent reports that it applied changes but Git diff capture finds zero changed files, the workflow stops as `no_changes` and skips validation, review, PR creation, and CI collection. This prevents empty pull requests from unedited branches.

`VALIDATION_PROVIDER=mock` records detected validation commands without running them. Set `VALIDATION_PROVIDER=local` to run commands in the prepared workspace with a timeout. Set `VALIDATION_PROVIDER=container` and `VALIDATION_CONTAINER_IMAGE` to run validation commands inside Docker with the workspace mounted at `VALIDATION_CONTAINER_WORKDIR`. On Windows, local validation resolves `.cmd` shims such as `npm.cmd`; if validation says `Command not found`, restart the terminal or service after installing Node.js so the server process receives the updated PATH.

Set `VALIDATION_COMMAND_ALLOWLIST` to a JSON array of allowed command prefixes. When configured, local validation records disallowed commands as `blocked` instead of running them:

```text
VALIDATION_COMMAND_ALLOWLIST=["npm test","npm run lint","go test"]
```

Set `VALIDATION_COMMAND_OVERRIDES` to a JSON object when a repository needs exact validation commands. Repository names use `owner/repo`, and `*` is a fallback:

```text
VALIDATION_COMMAND_OVERRIDES={"acme/app":["npm run ci","npm run lint"],"*":["npm test"]}
```

`REVIEW_PROVIDER=mock` reviews captured diff and validation metadata, producing findings for failed validation, truncated diffs, or no-change implementations. Set `REVIEW_PROVIDER=model` to use the dashboard-selected hosted AI provider (`openai`, `anthropic`, or `gemini`) for JSON code-review findings over the implementation summary, diff, and validation output.

`PR_PROVIDER=mock` prepares a pull request artifact without calling GitHub. Set `PR_PROVIDER=github_token` and provide `GITHUB_TOKEN` to create a real draft pull request. The GitHub provider checks for an existing open pull request from the workflow branch before creating a new one, so retrying a PR stage reuses the existing PR when possible.

Set `CI_PROVIDER=github` to collect GitHub check runs for the workflow branch after pull request creation. Passing checks move the workflow to `ci_passed`; pending, failing, or unavailable checks are stored as `ci_pending`; unexpected API collection failures are retryable as `ci_status_failed`. For fine-grained personal access tokens or GitHub Apps, grant read-only Checks access. If you do not need CI collection yet, set `CI_PROVIDER=none`.

Set `ISSUE_COMMENT_PROVIDER=mock` to record plan/status comments on workflows without calling GitHub, or `ISSUE_COMMENT_PROVIDER=github_token` with `GITHUB_TOKEN` to publish issue comments. When enabled, plan comments tell maintainers to reply with `/ai approve` or `/ai reject`; `issue_comment` webhooks with those commands approve or reject the workflow.

Set `AUDIT_LOG_PROVIDER=file` to append workflow lifecycle events to `AUDIT_LOG_PATH` as JSON Lines. Audit entries include workflow id, status, repository, issue number, and the latest workflow event.

Command output from implementation and local validation is redacted before persistence. Built-in redaction covers common GitHub tokens, OpenAI-style API keys, and PEM private keys. Set `SECRET_REDACTION_PATTERNS` to a JSON array of extra regular expressions for environment-specific secrets.

Set `REPOSITORY_CONFIG` to a JSON object for repo-specific overrides. Keys are `owner/repo`; values override compatible config fields for workflows from that repository. A `validationCommands` array is treated as that repo's exact validation command override.

```text
REPOSITORY_CONFIG={"acme/app":{"validationProvider":"local","validationCommands":["npm test"],"validationCommandAllowlist":["npm test"]}}
```

`WORKFLOW_STORE_PROVIDER=sqlite` persists workflows to `WORKFLOW_STORE_PATH` with indexed columns for status, repository, issue number, and updated time. Use this for real local runs. Set it to `file` for the older JSON-file store, or `memory` for ephemeral test/dev runs.

`WORKFLOW_EXECUTION_MODE=sync` keeps approval/retry requests open until the full workflow finishes, which is convenient in tests and local smoke runs. Set `WORKFLOW_EXECUTION_MODE=async` for real usage so approval/retry requests return with `queued` while implementation, validation, review, and PR creation continue in the background.

## Human Approval

Approve a generated plan:

```bash
curl -X POST http://localhost:3000/workflows/acme%2Fapp%23issue-42/approve \
  -H "Content-Type: application/json" \
  -d "{\"reviewer\":\"sam\",\"comment\":\"Looks good\"}"
```

Reject a generated plan:

```bash
curl -X POST http://localhost:3000/workflows/acme%2Fapp%23issue-42/reject \
  -H "Content-Type: application/json" \
  -d "{\"reviewer\":\"sam\",\"comment\":\"Needs a smaller scope\"}"
```

Retry a failed workflow:

```bash
curl -X POST http://localhost:3000/workflows/acme%2Fapp%23issue-42/retry \
  -H "Content-Type: application/json" \
  -d "{\"reviewer\":\"sam\",\"comment\":\"Transient provider issue is fixed\"}"
```

See [ROADMAP.md](./ROADMAP.md) for completed work and remaining MVP tasks.

For a step-by-step real setup path, see [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md).
