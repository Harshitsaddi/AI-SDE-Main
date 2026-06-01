# AI SDE Workflow Implementation Guide

This guide takes the project from local smoke testing to real GitHub issue-driven implementation.

## 1. Verify The Project

Install Node.js 24 or newer. The app uses Node's built-in SQLite module for the default workflow store.

```powershell
node --version
npm test
npm start
```

Open:

```text
http://localhost:3000
```

The dashboard should load even before any webhooks arrive.

Use the Readiness panel before a real run. It checks the dashboard token, webhook secret, GitHub API credentials, AI planner key or command, implementation provider, validation provider, execution mode, and workflow store.

If local validation fails with `Command not found: npm` or `spawn npm ENOENT` on Windows, install Node.js with npm, then restart the terminal or service that runs AI SDE so `npm.cmd` is visible on PATH.

## 2. Local Safe Mode

Create `.env`:

```powershell
Copy-Item .env.example .env
```

Use this first:

```text
PORT=3000
DASHBOARD_TOKEN=replace-with-a-long-random-dashboard-token
GITHUB_WEBHOOK_SECRET=replace-with-a-long-random-secret
AI_PROVIDER=mock
BRANCH_PROVIDER=mock
WORKSPACE_PROVIDER=mock
IMPLEMENTATION_PROVIDER=mock
VALIDATION_PROVIDER=mock
REVIEW_PROVIDER=mock
PR_PROVIDER=mock
CI_PROVIDER=none
ISSUE_COMMENT_PROVIDER=mock
WORKFLOW_STORE_PROVIDER=sqlite
WORKFLOW_STORE_PATH=var/data/workflows.sqlite
WORKFLOW_EXECUTION_MODE=sync
AUDIT_LOG_PROVIDER=file
AUDIT_LOG_PATH=var/audit/workflow-audit.jsonl
```

This proves planning, approval, retry, dashboard detail views, comments, persistence, and audit logging without changing a real repository.

When `DASHBOARD_TOKEN` is set, the dashboard will ask for that token before loading workflows or AI settings. Keep it set when using ngrok or any public tunnel.

For real runs with Aider or another implementation agent, switch to:

```text
WORKFLOW_EXECUTION_MODE=async
```

That makes approvals and retries return immediately as `queued` while the workflow continues in the background.

## 3. Expose Localhost To GitHub

For local webhook testing, use a tunnel such as ngrok or Cloudflare Tunnel:

```powershell
ngrok http 3000
```

Your webhook URL will be:

```text
https://your-tunnel-url/webhooks/github
```

## 4. Create The GitHub Webhook

In the target repository:

1. Go to `Settings -> Webhooks -> Add webhook`.
2. Payload URL: your tunnel URL plus `/webhooks/github`.
3. Content type: `application/json`.
4. Secret: same value as `GITHUB_WEBHOOK_SECRET`.
5. Events:
   - Issues
   - Issue comments

Open a test issue. The workflow should appear in the dashboard.

## 5. Real GitHub Auth

For quick testing with a fine-grained token:

```text
GITHUB_AUTH_PROVIDER=token
GITHUB_TOKEN=github_pat_...
BRANCH_PROVIDER=github_token
PR_PROVIDER=github_token
ISSUE_COMMENT_PROVIDER=github_token
```

Token permissions should include repository contents write access, pull request write access, and issue comment write access.

For production-style auth, use a GitHub App:

```text
GITHUB_AUTH_PROVIDER=app
GITHUB_APP_ID=...
GITHUB_APP_PRIVATE_KEY=...
GITHUB_APP_INSTALLATION_ID=...
BRANCH_PROVIDER=github_token
PR_PROVIDER=github_token
ISSUE_COMMENT_PROVIDER=github_token
```

If the private key is stored as one environment variable, use escaped newlines.

## 6. Real Workspace Checkout

Enable real repository checkout:

```text
WORKSPACE_PROVIDER=git
WORKSPACE_ROOT=var/workspaces
```

Make sure the machine running this service can clone the repository. For private repos, configure Git Credential Manager, SSH, or another credential helper outside the app.

## 7. Choose The AI Planner From The Dashboard

Open the dashboard:

```text
http://localhost:3000
```

Use `AI Settings` to choose:

```text
ChatGPT / OpenAI
Claude / Anthropic
Gemini / Google
```

Then select or type the model name, paste the provider API key, and click `Save`. The key is stored on the server at:

```text
var/data/ai-settings.json
```

The browser only shows whether a key is configured; it does not receive the saved key back from the server. New GitHub issue workflows use the latest saved provider/model/key. You can still set defaults in `.env`:

```text
AI_PROVIDER=openai
AI_MODEL=gpt-4o-mini
OPENAI_API_KEY=...
AI_SETTINGS_PATH=var/data/ai-settings.json
```

Provider values are:

```text
openai
anthropic
gemini
mock
command
```

## 8. Real Implementation Agent

The command provider is the practical bridge to tools like Aider, Claude Code, or your own agent script.

Example with Aider:

```text
IMPLEMENTATION_PROVIDER=command
IMPLEMENTATION_COMMAND=aider --yes --no-gitignore --model {aiModel} --message-file {promptPath}
IMPLEMENTATION_COMMAND_ALLOWLIST=["aider"]
IMPLEMENTATION_COMMAND_TIMEOUT_MS=600000
```

If the command times out, the first thing to check is whether the agent is waiting for confirmation or trying to use a model without the dashboard-selected API key. `--yes` keeps Aider noninteractive, `--no-gitignore` avoids Aider editing `.gitignore`, and `{aiModel}` lets the dashboard-selected model flow through directly.

For Gemini, keep the dashboard model as `gemini-2.5-flash` or `gemini-2.5-pro`. The implementation runner passes that to Aider as `gemini/gemini-...`, which uses a normal Google AI Studio `GEMINI_API_KEY` instead of Vertex AI project credentials.

The implementation prompt does not include the GitHub issue URL. It uses the issue title/body already received from the webhook plus checked-out repository files, so Aider should not try to scrape GitHub. If Aider says the issue is ambiguous or asks for clarification, the workflow stops as `needs_clarification`.

The provider writes:

```text
.ai-sde/implementation-prompt.md
```

It also exposes:

```text
AI_SDE_IMPLEMENTATION_PROMPT
AI_SDE_WORKSPACE
AI_SDE_WORKFLOW_ID
AI_SDE_AI_PROVIDER
AI_SDE_AI_MODEL
AI_SDE_AI_API_KEY
```

Use those variables in a custom implementation wrapper when you want one command to route to OpenAI, Anthropic, or Gemini based on the dashboard selection.

If the target repository includes `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, or `.github/copilot-instructions.md`, the app includes those instructions in the implementation prompt automatically.

For real AI review, set:

```text
REVIEW_PROVIDER=model
```

This uses the same dashboard-selected hosted provider and API key as planning.

## 9. Real Validation

Local validation:

```text
VALIDATION_PROVIDER=local
VALIDATION_COMMAND_ALLOWLIST=["npm test","npm run lint","npm run typecheck"]
```

Container validation:

```text
VALIDATION_PROVIDER=container
VALIDATION_CONTAINER_IMAGE=node:22
VALIDATION_CONTAINER_WORKDIR=/workspace
VALIDATION_CONTAINER_EXTRA_ARGS=["--network","none"]
VALIDATION_COMMAND_ALLOWLIST=["npm test","npm run lint"]
```

## 10. Optional Command Planner

Use this when you want an external planning/model tool instead of the mock planner:

```text
AI_PROVIDER=command
AI_COMMAND=my-planner --input {inputPath} --output {outputPath}
AI_COMMAND_ALLOWLIST=["my-planner"]
AI_COMMAND_WORK_DIR=var/ai
```

The command must return a JSON plan through stdout or `{outputPath}`.

## 11. Per-Repository Overrides

Use `REPOSITORY_CONFIG` when different repos need different commands or providers:

```text
REPOSITORY_CONFIG={"acme/app":{"validationProvider":"local","validationCommands":["npm test"],"validationCommandAllowlist":["npm test"]}}
```

## 12. Normal Workflow

1. Create a GitHub issue.
2. The app receives the webhook and creates a plan.
3. The app comments on the issue if `ISSUE_COMMENT_PROVIDER` is enabled.
4. Approve in the dashboard or comment:

```text
/ai approve
```

5. The app creates a branch, prepares a workspace, runs implementation, captures diff, validates, reviews, and creates a PR artifact or real PR.
6. If the implementation agent asks for clarification, the workflow stops as `needs_clarification`.
7. If the implementation agent makes no actual git changes, the workflow stops as `no_changes` and does not create a PR.
8. If a stage fails, fix the cause and click Retry in the dashboard.

Reject with:

```text
/ai reject
```

## 13. Run With Docker Compose

```powershell
Copy-Item .env.example .env
docker compose up --build
```

The compose file persists app data under the `ai-sde-data` volume.

## 14. Check Outputs

Workflow data:

```text
var/data/workflows.sqlite
```

Audit log:

```text
var/audit/workflow-audit.jsonl
```

Workspace checkouts:

```text
var/workspaces
```

AI settings:

```text
var/data/ai-settings.json
```

## 15. Recommended First Real Run

Start with:

```text
AI_PROVIDER=mock
WORKSPACE_PROVIDER=git
IMPLEMENTATION_PROVIDER=mock
VALIDATION_PROVIDER=mock
BRANCH_PROVIDER=github_token
PR_PROVIDER=mock
ISSUE_COMMENT_PROVIDER=github_token
WORKFLOW_EXECUTION_MODE=async
CI_PROVIDER=github
```

Then move one step at a time:

1. Turn on real PRs with `PR_PROVIDER=github_token`.
2. Turn on CI collection with `CI_PROVIDER=github`.
3. Turn on model review with `REVIEW_PROVIDER=model`.
4. Turn on local validation with `VALIDATION_PROVIDER=local`.
5. Turn on command implementation with `IMPLEMENTATION_PROVIDER=command`.
6. Add Docker validation once local validation is stable.
