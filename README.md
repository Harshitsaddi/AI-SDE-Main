# AI SDE Workflow MVP

This repository starts the first slice of an AI-assisted software engineering workflow platform:

1. Receive a GitHub issue webhook.
2. Validate the webhook signature.
3. Extract issue and repository context.
4. Generate a structured implementation plan.
5. Store the workflow in an approval-ready state.

The first implementation uses only Node.js built-ins so it can run before package installation or infrastructure decisions.

## Run

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
GITHUB_WEBHOOK_SECRET=...
AI_PROVIDER=mock
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
ISSUE_COMMENT_PROVIDER=none
AUDIT_LOG_PROVIDER=none
AUDIT_LOG_PATH=var/audit/workflow-audit.jsonl
SECRET_REDACTION_PATTERNS=
REPOSITORY_CONFIG=
WORKFLOW_STORE_PROVIDER=file
WORKFLOW_STORE_PATH=var/data/workflows.json
```

`AI_PROVIDER=mock` returns a deterministic plan and is useful while wiring GitHub and approval UX.

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

### `POST /webhooks/github`

Accepts GitHub `issues` and `issue_comment` events. For MVP, `opened`, `reopened`, and `edited` issue actions create or refresh an implementation plan. `issue_comment` `created` events can approve or reject a workflow when the comment body is `/ai approve` or `/ai reject`.

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

The included `Dockerfile` runs the service with Node 22 Alpine. `compose.yaml` mounts `/app/var` for workflow data, audit logs, and workspaces. For Git-backed workspaces, make sure the container has network access and credentials for private repositories. For Docker-isolated validation or implementation from inside the service container, mount the host Docker socket intentionally and restrict command allowlists.

## Current MVP Boundary

This slice stops after human approval, branch creation, workspace preparation, repository inspection, mock implementation, diff capture, and validation collection. Branch creation supports a local mock provider and a token-based GitHub provider. Workspace preparation supports a mock local provider and a `git` provider that checks out the generated branch under `WORKSPACE_ROOT`.

For real local checkout, set:

```text
WORKSPACE_PROVIDER=git
```

The `git` provider expects the repository `clone_url` from the GitHub webhook to be accessible by the local `git` command. For private repositories, configure credentials outside the app, such as Git Credential Manager or an environment-specific credential helper.

Repository inspection runs after workspace preparation. The local inspector scans checked-out workspaces, skips common dependency/build folders, reads important files, detects stack hints, suggests validation commands, and searches for issue-related terms.

`IMPLEMENTATION_PROVIDER=mock` records the implementation plan, candidate files, and validation commands without changing code. It is the adapter seam for a real coding agent provider.

Set `IMPLEMENTATION_PROVIDER=command` to run a local implementation agent in the prepared workspace. `IMPLEMENTATION_COMMAND` is parsed without a shell and may use `{promptPath}`, `{workspacePath}`, and `{workflowId}` placeholders. The provider writes `.ai-sde/implementation-prompt.md` before invoking the command and also exposes `AI_SDE_IMPLEMENTATION_PROMPT`, `AI_SDE_WORKSPACE`, and `AI_SDE_WORKFLOW_ID` environment variables.

Set `IMPLEMENTATION_COMMAND_ALLOWLIST` to a JSON array of allowed command prefixes to restrict command implementation execution:

Example:

```text
IMPLEMENTATION_PROVIDER=command
IMPLEMENTATION_COMMAND=aider --message-file {promptPath}
IMPLEMENTATION_COMMAND_ALLOWLIST=["aider"]
```

Set `IMPLEMENTATION_CONTAINER_IMAGE` to run the command implementation provider inside Docker. The workspace is mounted at `IMPLEMENTATION_CONTAINER_WORKDIR`, and `IMPLEMENTATION_CONTAINER_EXTRA_ARGS` can pass a JSON array of additional `docker run` arguments.

`DIFF_PROVIDER=git` captures changed files and a bounded diff from the workspace after implementation.

`VALIDATION_PROVIDER=mock` records detected validation commands without running them. Set `VALIDATION_PROVIDER=local` to run commands in the prepared workspace with a timeout. Set `VALIDATION_PROVIDER=container` and `VALIDATION_CONTAINER_IMAGE` to run validation commands inside Docker with the workspace mounted at `VALIDATION_CONTAINER_WORKDIR`.

Set `VALIDATION_COMMAND_ALLOWLIST` to a JSON array of allowed command prefixes. When configured, local validation records disallowed commands as `blocked` instead of running them:

```text
VALIDATION_COMMAND_ALLOWLIST=["npm test","npm run lint","go test"]
```

Set `VALIDATION_COMMAND_OVERRIDES` to a JSON object when a repository needs exact validation commands. Repository names use `owner/repo`, and `*` is a fallback:

```text
VALIDATION_COMMAND_OVERRIDES={"acme/app":["npm run ci","npm run lint"],"*":["npm test"]}
```

`REVIEW_PROVIDER=mock` reviews captured diff and validation metadata, producing findings for failed validation, truncated diffs, or no-change implementations.

`PR_PROVIDER=mock` prepares a pull request artifact without calling GitHub. Set `PR_PROVIDER=github_token` and provide `GITHUB_TOKEN` to create a real draft pull request.

Set `ISSUE_COMMENT_PROVIDER=mock` to record plan/status comments on workflows without calling GitHub, or `ISSUE_COMMENT_PROVIDER=github_token` with `GITHUB_TOKEN` to publish issue comments. When enabled, plan comments tell maintainers to reply with `/ai approve` or `/ai reject`; `issue_comment` webhooks with those commands approve or reject the workflow.

Set `AUDIT_LOG_PROVIDER=file` to append workflow lifecycle events to `AUDIT_LOG_PATH` as JSON Lines. Audit entries include workflow id, status, repository, issue number, and the latest workflow event.

Command output from implementation and local validation is redacted before persistence. Built-in redaction covers common GitHub tokens, OpenAI-style API keys, and PEM private keys. Set `SECRET_REDACTION_PATTERNS` to a JSON array of extra regular expressions for environment-specific secrets.

Set `REPOSITORY_CONFIG` to a JSON object for repo-specific overrides. Keys are `owner/repo`; values override compatible config fields for workflows from that repository. A `validationCommands` array is treated as that repo's exact validation command override.

```text
REPOSITORY_CONFIG={"acme/app":{"validationProvider":"local","validationCommands":["npm test"],"validationCommandAllowlist":["npm test"]}}
```

`WORKFLOW_STORE_PROVIDER=file` persists workflows to `WORKFLOW_STORE_PATH` so local workflow state survives service restarts. Set it to `memory` for ephemeral test/dev runs.

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
