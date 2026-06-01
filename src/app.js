import { createServer } from "node:http";
import { URL } from "node:url";
import { generatePlan } from "./ai/planner.js";
import { createBranch } from "./branches/branchService.js";
import { publishIssueComment } from "./comments/issueCommentService.js";
import { collectCiStatus } from "./ci/ciStatusService.js";
import { configForRepository, loadConfig } from "./config.js";
import { buildRepositoryContext } from "./context/repositoryContext.js";
import { captureDiff } from "./diff/diffService.js";
import {
  issueCommentCommand,
  issueCommentEventToWorkflowId,
  issueEventToPlanningInput,
  shouldHandleIssueComment,
  shouldPlanIssue
} from "./github/issues.js";
import { verifyGitHubSignature } from "./github/signature.js";
import { providerHealth } from "./health/providerHealth.js";
import { sendHtml } from "./http/html.js";
import { readJsonRequest, sendJson } from "./http/json.js";
import { runImplementation } from "./implementation/implementationService.js";
import { inspectRepository } from "./inspection/inspectionService.js";
import { createPullRequest } from "./pullRequests/pullRequestService.js";
import { runReview } from "./review/reviewService.js";
import { createAiSettingsStore } from "./settings/aiSettingsStore.js";
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
  pullRequestService = createPullRequest,
  ciStatusService = collectCiStatus,
  issueCommentService = publishIssueComment,
  aiSettingsStore
}) {
  const appConfig = {
    ...loadConfig({}),
    ...config
  };
  const aiSettings = aiSettingsStore || createAiSettingsStore(appConfig);
  const pipelineStages = [
    "branch",
    "workspace",
    "inspection",
    "implementation",
    "diff",
    "validation",
    "review",
    "pullRequest",
    "ciStatus"
  ];
  const runningPipelines = new Set();
  const queuedPipelines = new Map();
  let pipelineQueue = Promise.resolve();

  function activeConfig() {
    return {
      ...appConfig,
      ...aiSettings.getConfigOverrides()
    };
  }

  function configForWorkflow(workflow) {
    return configForRepository(activeConfig(), workflow.planningInput?.repository?.fullName);
  }

  async function runWorkflowPipeline(id, startStage = "branch") {
    const startIndex = pipelineStages.indexOf(startStage);

    if (startIndex === -1) {
      throw new Error(`Unsupported workflow stage: ${startStage}`);
    }

    if (runningPipelines.has(id)) {
      return { ok: false, reason: "workflow_pipeline_running" };
    }

    runningPipelines.add(id);
    let activeStage = startStage;

    try {
      for (const stage of pipelineStages.slice(startIndex)) {
        activeStage = stage;
        const workflow = store.get(id);
        const workflowConfig = configForWorkflow(workflow);

        if (stage === "branch") {
          const branch = await branchService({ config: workflowConfig, workflow });
          store.markBranchCreated(id, branch);
        } else if (stage === "workspace") {
          const workspace = await workspaceService({ config: workflowConfig, workflow });
          store.markWorkspacePrepared(id, workspace);
        } else if (stage === "inspection") {
          const repositoryInspection = await inspectionService({ config: workflowConfig, workflow });
          store.markRepositoryInspected(id, repositoryInspection);
        } else if (stage === "implementation") {
          const implementation = await implementationService({ config: workflowConfig, workflow });
          store.markImplementationCompleted(id, implementation);
          if (implementation.needsClarification) {
            break;
          }
        } else if (stage === "diff") {
          const diff = await diffService({ config: workflowConfig, workflow });
          store.markDiffCaptured(id, diff);
          const diffWorkflow = store.get(id);
          if (diff.captured && diff.changedFiles?.length === 0 && diffWorkflow?.implementation?.applied !== false) {
            store.markNoChangesDetected(id, diff);
            break;
          }
        } else if (stage === "validation") {
          const validation = await validationService({ config: workflowConfig, workflow });
          store.markValidationCompleted(id, validation);
        } else if (stage === "review") {
          const review = await reviewService({ config: workflowConfig, workflow });
          store.markReviewCompleted(id, review);
        } else if (stage === "pullRequest") {
          const pullRequest = await pullRequestService({ config: workflowConfig, workflow });
          store.markPullRequestCreated(id, pullRequest);
        } else if (stage === "ciStatus") {
          if (workflowConfig.ciProvider !== "none") {
            const ciStatus = await ciStatusService({ config: workflowConfig, workflow });
            if (ciStatus) {
              store.markCiStatusCollected(id, ciStatus);
            }
          }
        }
      }
    } catch (error) {
      if (activeStage === "branch") {
        store.markBranchCreationFailed(id, error);
      } else if (activeStage === "workspace") {
        store.markWorkspacePreparationFailed(id, error);
      } else if (activeStage === "inspection") {
        store.markRepositoryInspectionFailed(id, error);
      } else if (activeStage === "implementation") {
        store.markImplementationFailed(id, error);
      } else if (activeStage === "diff") {
        store.markDiffCaptureFailed(id, error);
      } else if (activeStage === "validation") {
        store.markValidationFailed(id, error);
      } else if (activeStage === "review") {
        store.markReviewFailed(id, error);
      } else if (activeStage === "pullRequest") {
        store.markPullRequestCreationFailed(id, error);
      } else if (activeStage === "ciStatus") {
        store.markCiStatusFailed(id, error);
      }
    } finally {
      runningPipelines.delete(id);
    }

    return { ok: true };
  }

  function queueWorkflowPipeline(id, startStage, source) {
    if (runningPipelines.has(id) || queuedPipelines.has(id)) {
      return { ok: false, reason: "workflow_pipeline_running" };
    }

    const queued = store.markWorkflowQueued(id, { stage: startStage, source });
    if (!queued.ok) {
      return queued;
    }

    queuedPipelines.set(id, startStage);
    pipelineQueue = pipelineQueue
      .catch(() => {})
      .then(async () => {
        queuedPipelines.delete(id);
        await runWorkflowPipeline(id, startStage);
        await publishWorkflowComment(id, "status");
      });

    return { ok: true, queued: true };
  }

  async function startWorkflowPipeline(id, startStage, source) {
    if (appConfig.workflowExecutionMode === "async") {
      return queueWorkflowPipeline(id, startStage, source);
    }

    return runWorkflowPipeline(id, startStage);
  }

  async function publishWorkflowComment(id, kind) {
    const workflow = store.get(id);

    if (!workflow || activeConfig().issueCommentProvider === "none") {
      return;
    }

    try {
      const comment = await issueCommentService({ config: configForWorkflow(workflow), workflow, kind });
      store.markIssueCommentPublished(id, comment);
    } catch (error) {
      store.markIssueCommentFailed(id, error);
    }
  }

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
      if (shouldHandleIssueComment(eventName, payload)) {
        const result = await handleIssueCommentCommand(payload);
        sendJson(response, result.statusCode, result.body);
        return;
      }

      sendJson(response, 202, {
        status: "ignored",
        reason: "event_does_not_create_plan",
        eventName,
        action: payload?.action
      });
      return;
    }

    const planningInput = issueEventToPlanningInput(payload);
    const planningConfig = configForRepository(activeConfig(), planningInput.repository.fullName);
    const repositoryContext = await buildRepositoryContext(planningInput);
    const plan = await generatePlan({ config: planningConfig, planningInput, repositoryContext });
    const workflow = store.createFromPlan({ planningInput, plan });
    await publishWorkflowComment(workflow.id, "plan");

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
      const pipeline = await startWorkflowPipeline(id, "branch", "dashboard");
      if (!pipeline.ok) {
        sendJson(response, 409, {
          error: pipeline.reason,
          workflow: store.get(id)
        });
        return;
      }
    }
    await publishWorkflowComment(id, "status");

    const workflow = store.get(id);
    sendJson(response, appConfig.workflowExecutionMode === "async" && decision === "approve" ? 202 : 200, {
      status: workflow.status,
      workflow
    });
  }

  async function handleWorkflowRetry(request, response, id) {
    let parsed;

    try {
      parsed = await readJsonRequest(request);
    } catch (error) {
      sendJson(response, 400, { error: "invalid_json", message: error.message });
      return;
    }

    if (runningPipelines.has(id) || queuedPipelines.has(id)) {
      sendJson(response, 409, {
        error: "workflow_pipeline_running",
        workflow: store.get(id)
      });
      return;
    }

    const result = store.requestRetry(id, parsed.body || {});

    if (!result.ok) {
      const statusCode = result.reason === "workflow_not_found" ? 404 : 409;
      sendJson(response, statusCode, {
        error: result.reason,
        workflow: result.workflow || null
      });
      return;
    }

    const pipeline = await startWorkflowPipeline(id, result.stage, "dashboard");
    if (!pipeline.ok) {
      sendJson(response, 409, {
        error: pipeline.reason,
        workflow: store.get(id)
      });
      return;
    }
    await publishWorkflowComment(id, "status");

    const workflow = store.get(id);
    sendJson(response, appConfig.workflowExecutionMode === "async" ? 202 : 200, {
      status: workflow.status,
      workflow
    });
  }

  async function handleAiSettingsUpdate(request, response) {
    let parsed;

    try {
      parsed = await readJsonRequest(request);
    } catch (error) {
      sendJson(response, 400, { error: "invalid_json", message: error.message });
      return;
    }

    try {
      sendJson(response, 200, aiSettings.update(parsed.body || {}));
    } catch (error) {
      sendJson(response, 400, { error: "invalid_ai_settings", message: error.message });
    }
  }

  async function handleIssueCommentCommand(payload) {
    const command = issueCommentCommand(payload);

    if (!command) {
      return {
        statusCode: 202,
        body: {
          status: "ignored",
          reason: "comment_is_not_ai_command"
        }
      };
    }

    const id = issueCommentEventToWorkflowId(payload);
    const reviewer = payload.comment?.user?.login || "github-comment";
    const result = command === "approve"
      ? store.approve(id, { reviewer, comment: "Approved from GitHub issue comment." })
      : store.reject(id, { reviewer, comment: "Rejected from GitHub issue comment." });

    if (!result.ok) {
      return {
        statusCode: result.reason === "workflow_not_found" ? 404 : 409,
        body: {
          error: result.reason,
          workflow: result.workflow || null
        }
      };
    }

    if (command === "approve") {
      const pipeline = await startWorkflowPipeline(id, "branch", "issue_comment");
      if (!pipeline.ok) {
        return {
          statusCode: 409,
          body: {
            error: pipeline.reason,
            workflow: store.get(id)
          }
        };
      }
    }
    await publishWorkflowComment(id, "status");

    const workflow = store.get(id);
    return {
      statusCode: appConfig.workflowExecutionMode === "async" && command === "approve" ? 202 : 200,
      body: {
        status: workflow.status,
        workflow
      }
    };
  }

  async function route(request, response) {
    const url = new URL(request.url, "http://localhost");

    function dashboardAuthOk() {
      if (!appConfig.dashboardToken) {
        return true;
      }

      const header = request.headers.authorization || "";
      const match = header.match(/^Bearer\s+(.+)$/i);
      return match?.[1] === appConfig.dashboardToken;
    }

    function requireDashboardAuth() {
      if (dashboardAuthOk()) {
        return true;
      }

      response.setHeader("www-authenticate", "Bearer");
      sendJson(response, 401, {
        error: "unauthorized",
        message: "Dashboard token is required."
      });
      return false;
    }

    if (request.method === "GET" && url.pathname === "/") {
      sendHtml(response, 200, dashboardHtml());
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/health/providers") {
      if (!requireDashboardAuth()) return;
      sendJson(response, 200, providerHealth(activeConfig()));
      return;
    }

    if (request.method === "GET" && url.pathname === "/settings/ai") {
      if (!requireDashboardAuth()) return;
      sendJson(response, 200, aiSettings.getPublicSettings());
      return;
    }

    if (request.method === "PUT" && url.pathname === "/settings/ai") {
      if (!requireDashboardAuth()) return;
      await handleAiSettingsUpdate(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/webhooks/github") {
      await handleGitHubWebhook(request, response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/workflows") {
      if (!requireDashboardAuth()) return;
      sendJson(response, 200, { workflows: store.list() });
      return;
    }

    const approvalMatch = url.pathname.match(/^\/workflows\/(.+)\/approve$/);
    if (request.method === "POST" && approvalMatch) {
      if (!requireDashboardAuth()) return;
      await handleWorkflowDecision(request, response, decodeURIComponent(approvalMatch[1]), "approve");
      return;
    }

    const rejectionMatch = url.pathname.match(/^\/workflows\/(.+)\/reject$/);
    if (request.method === "POST" && rejectionMatch) {
      if (!requireDashboardAuth()) return;
      await handleWorkflowDecision(request, response, decodeURIComponent(rejectionMatch[1]), "reject");
      return;
    }

    const retryMatch = url.pathname.match(/^\/workflows\/(.+)\/retry$/);
    if (request.method === "POST" && retryMatch) {
      if (!requireDashboardAuth()) return;
      await handleWorkflowRetry(request, response, decodeURIComponent(retryMatch[1]));
      return;
    }

    const workflowMatch = url.pathname.match(/^\/workflows\/(.+)$/);
    if (request.method === "GET" && workflowMatch) {
      if (!requireDashboardAuth()) return;
      const workflow = store.get(decodeURIComponent(workflowMatch[1]));
      sendJson(response, workflow ? 200 : 404, workflow || { error: "workflow_not_found" });
      return;
    }

    sendJson(response, 404, { error: "not_found" });
  }

  return {
    store,
    queue: {
      pending() {
        return queuedPipelines.size;
      },
      running() {
        return runningPipelines.size;
      },
      drain() {
        return pipelineQueue.catch(() => {});
      }
    },
    server: createServer((request, response) => {
      route(request, response).catch((error) => {
        sendJson(response, 500, { error: "internal_error", message: error.message });
      });
    })
  };
}
