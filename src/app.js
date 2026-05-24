import { createServer } from "node:http";
import { URL } from "node:url";
import { generatePlan } from "./ai/planner.js";
import { createBranch } from "./branches/branchService.js";
import { loadConfig } from "./config.js";
import { buildRepositoryContext } from "./context/repositoryContext.js";
import { captureDiff } from "./diff/diffService.js";
import { issueEventToPlanningInput, shouldPlanIssue } from "./github/issues.js";
import { verifyGitHubSignature } from "./github/signature.js";
import { sendHtml } from "./http/html.js";
import { readJsonRequest, sendJson } from "./http/json.js";
import { runImplementation } from "./implementation/implementationService.js";
import { inspectRepository } from "./inspection/inspectionService.js";
import { createPullRequest } from "./pullRequests/pullRequestService.js";
import { runReview } from "./review/reviewService.js";
import { dashboardHtml } from "./ui/dashboard.js";
import { runValidation } from "./validation/validationService.js";
import { WorkflowStore } from "./workflows/store.js";
import { prepareWorkspace } from "./workspaces/workspaceService.js";

export function createApp({
  config = {},
  store = new WorkflowStore(),
  branchService = createBranch,
  workspaceService = prepareWorkspace,
  inspectionService = inspectRepository,
  implementationService = runImplementation,
  diffService = captureDiff,
  validationService = runValidation,
  reviewService = runReview,
  pullRequestService = createPullRequest
}) {
  const appConfig = {
    ...loadConfig({}),
    ...config
  };

  async function handleGitHubWebhook(request, response) {
    let parsed;

    try {
      parsed = await readJsonRequest(request);
    } catch (error) {
      sendJson(response, 400, { error: "invalid_json", message: error.message });
      return;
    }

    const signatureCheck = verifyGitHubSignature({
      secret: appConfig.githubWebhookSecret,
      rawBody: parsed.rawBody,
      signature: request.headers["x-hub-signature-256"]
    });

    if (!signatureCheck.ok) {
      sendJson(response, 401, { error: signatureCheck.reason });
      return;
    }

    const eventName = request.headers["x-github-event"];
    const payload = parsed.body;

    if (!shouldPlanIssue(eventName, payload)) {
      sendJson(response, 202, {
        status: "ignored",
        reason: "event_does_not_create_plan",
        eventName,
        action: payload?.action
      });
      return;
    }

    const planningInput = issueEventToPlanningInput(payload);
    const repositoryContext = await buildRepositoryContext(planningInput);
    const plan = await generatePlan({ config: appConfig, planningInput, repositoryContext });
    const workflow = store.createFromPlan({ planningInput, plan });

    sendJson(response, 201, {
      status: workflow.status,
      workflowId: workflow.id,
      plan: workflow.plan
    });
  }

  async function handleWorkflowDecision(request, response, id, decision) {
    let parsed;

    try {
      parsed = await readJsonRequest(request);
    } catch (error) {
      sendJson(response, 400, { error: "invalid_json", message: error.message });
      return;
    }

    const input = parsed.body || {};
    const result = decision === "approve"
      ? store.approve(id, input)
      : store.reject(id, input);

    if (!result.ok) {
      const statusCode = result.reason === "workflow_not_found" ? 404 : 409;
      sendJson(response, statusCode, {
        error: result.reason,
        workflow: result.workflow || null
      });
      return;
    }

    if (decision === "approve") {
      try {
        const branch = await branchService({ config: appConfig, workflow: result.workflow });
        const branchResult = store.markBranchCreated(id, branch);
        const workspace = await workspaceService({ config: appConfig, workflow: branchResult.workflow });
        const workspaceResult = store.markWorkspacePrepared(id, workspace);
        const repositoryInspection = await inspectionService({
          config: appConfig,
          workflow: workspaceResult.workflow
        });
        const inspectionResult = store.markRepositoryInspected(id, repositoryInspection);
        const implementation = await implementationService({
          config: appConfig,
          workflow: inspectionResult.workflow
        });
        const implementationResult = store.markImplementationCompleted(id, implementation);
        const diff = await diffService({
          config: appConfig,
          workflow: implementationResult.workflow
        });
        const diffResult = store.markDiffCaptured(id, diff);
        const validation = await validationService({
          config: appConfig,
          workflow: diffResult.workflow
        });
        const validationResult = store.markValidationCompleted(id, validation);
        const review = await reviewService({
          config: appConfig,
          workflow: validationResult.workflow
        });
        const reviewResult = store.markReviewCompleted(id, review);
        const pullRequest = await pullRequestService({
          config: appConfig,
          workflow: reviewResult.workflow
        });
        store.markPullRequestCreated(id, pullRequest);
      } catch (error) {
        const latestWorkflow = store.get(id);

        if (latestWorkflow?.status === "review_completed") {
          store.markPullRequestCreationFailed(id, error);
        } else if (latestWorkflow?.status === "validation_completed") {
          store.markReviewFailed(id, error);
        } else if (latestWorkflow?.status === "diff_captured") {
          store.markValidationFailed(id, error);
        } else if (latestWorkflow?.status === "implementation_completed") {
          store.markDiffCaptureFailed(id, error);
        } else if (latestWorkflow?.status === "repository_inspected") {
          store.markImplementationFailed(id, error);
        } else if (latestWorkflow?.status === "workspace_prepared") {
          store.markRepositoryInspectionFailed(id, error);
        } else if (latestWorkflow?.status === "branch_created") {
          store.markWorkspacePreparationFailed(id, error);
        } else {
          store.markBranchCreationFailed(id, error);
        }
      }
    }

    sendJson(response, 200, {
      status: result.workflow.status,
      workflow: result.workflow
    });
  }

  async function route(request, response) {
    const url = new URL(request.url, "http://localhost");

    if (request.method === "GET" && url.pathname === "/") {
      sendHtml(response, 200, dashboardHtml());
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok" });
      return;
    }

    if (request.method === "POST" && url.pathname === "/webhooks/github") {
      await handleGitHubWebhook(request, response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/workflows") {
      sendJson(response, 200, { workflows: store.list() });
      return;
    }

    const approvalMatch = url.pathname.match(/^\/workflows\/(.+)\/approve$/);
    if (request.method === "POST" && approvalMatch) {
      await handleWorkflowDecision(request, response, decodeURIComponent(approvalMatch[1]), "approve");
      return;
    }

    const rejectionMatch = url.pathname.match(/^\/workflows\/(.+)\/reject$/);
    if (request.method === "POST" && rejectionMatch) {
      await handleWorkflowDecision(request, response, decodeURIComponent(rejectionMatch[1]), "reject");
      return;
    }

    const workflowMatch = url.pathname.match(/^\/workflows\/(.+)$/);
    if (request.method === "GET" && workflowMatch) {
      const workflow = store.get(decodeURIComponent(workflowMatch[1]));
      sendJson(response, workflow ? 200 : 404, workflow || { error: "workflow_not_found" });
      return;
    }

    sendJson(response, 404, { error: "not_found" });
  }

  return {
    store,
    server: createServer((request, response) => {
      route(request, response).catch((error) => {
        sendJson(response, 500, { error: "internal_error", message: error.message });
      });
    })
  };
}
