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

## Environment

Copy `.env.example` into your shell environment and set:

```text
PORT=3000
GITHUB_WEBHOOK_SECRET=...
AI_PROVIDER=mock
BRANCH_PROVIDER=mock
GITHUB_TOKEN=
GITHUB_API_BASE_URL=https://api.github.com
WORKSPACE_PROVIDER=mock
WORKSPACE_ROOT=var/workspaces
INSPECTION_PROVIDER=local
INSPECTION_MAX_FILES=500
IMPLEMENTATION_PROVIDER=mock
VALIDATION_PROVIDER=mock
VALIDATION_COMMAND_TIMEOUT_MS=120000
DIFF_PROVIDER=git
DIFF_MAX_BYTES=200000
REVIEW_PROVIDER=mock
PR_PROVIDER=mock
PR_DRAFT=true
WORKFLOW_STORE_PROVIDER=file
WORKFLOW_STORE_PATH=var/data/workflows.json
```

`AI_PROVIDER=mock` returns a deterministic plan and is useful while wiring GitHub and approval UX.

`BRANCH_PROVIDER=mock` records branch creation without calling GitHub. For a token-based MVP bridge, set `BRANCH_PROVIDER=github_token` and provide a fine-grained GitHub token with repository contents write access.

## Endpoints

### `GET /`

Shows a local workflow dashboard with refresh, approval, and rejection actions.

### `GET /health`

Returns service status.

### `POST /webhooks/github`

Accepts GitHub `issues` events. For MVP, `opened`, `reopened`, and `edited` issue actions create or refresh an implementation plan.

Required headers:

```text
X-GitHub-Event: issues
X-Hub-Signature-256: sha256=...
```

### `GET /workflows`

Lists stored workflows.

### `GET /workflows/:id`

Returns a single workflow.

## Test

```bash
npm test
```

## Current MVP Boundary

This slice stops after human approval, branch creation, workspace preparation, repository inspection, mock implementation, diff capture, and validation collection. Branch creation supports a local mock provider and a token-based GitHub provider. Workspace preparation supports a mock local provider and a `git` provider that checks out the generated branch under `WORKSPACE_ROOT`.

For real local checkout, set:

```text
WORKSPACE_PROVIDER=git
```

The `git` provider expects the repository `clone_url` from the GitHub webhook to be accessible by the local `git` command. For private repositories, configure credentials outside the app, such as Git Credential Manager or an environment-specific credential helper.

Repository inspection runs after workspace preparation. The local inspector scans checked-out workspaces, skips common dependency/build folders, reads important files, detects stack hints, suggests validation commands, and searches for issue-related terms.

`IMPLEMENTATION_PROVIDER=mock` records the implementation plan, candidate files, and validation commands without changing code. It is the adapter seam for a real coding agent provider.

`DIFF_PROVIDER=git` captures changed files and a bounded diff from the workspace after implementation.

`VALIDATION_PROVIDER=mock` records detected validation commands without running them. Set `VALIDATION_PROVIDER=local` to run commands in the prepared workspace with a timeout.

`REVIEW_PROVIDER=mock` reviews captured diff and validation metadata, producing findings for failed validation, truncated diffs, or no-change implementations.

`PR_PROVIDER=mock` prepares a pull request artifact without calling GitHub. Set `PR_PROVIDER=github_token` and provide `GITHUB_TOKEN` to create a real draft pull request.

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

See [ROADMAP.md](./ROADMAP.md) for completed work and remaining MVP tasks.
