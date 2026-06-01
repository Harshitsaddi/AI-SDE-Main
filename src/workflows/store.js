export class WorkflowStore {
  #workflows = new Map();
  #onChange = null;
  #onAudit = null;

  constructor({ workflows = [], onChange = null, onAudit = null } = {}) {
    this.#onChange = onChange;
    this.#onAudit = onAudit;

    for (const workflow of workflows) {
      this.#workflows.set(workflow.id, workflow);
    }
  }

  #save(workflow = null) {
    if (this.#onChange) {
      this.#onChange(this.list(), workflow);
    }

    if (workflow && this.#onAudit) {
      this.#onAudit({
        at: new Date().toISOString(),
        workflowId: workflow.id,
        status: workflow.status,
        event: workflow.events.at(-1) || null,
        repository: workflow.planningInput?.repository?.fullName || "",
        issueNumber: workflow.planningInput?.issue?.number || null
      });
    }
  }

  createFromPlan({ planningInput, plan }) {
    const now = new Date().toISOString();
    const id = [
      planningInput.repository.fullName || "unknown-repo",
      `issue-${planningInput.issue.number || planningInput.issue.id || "unknown"}`
    ].join("#");

    const workflow = {
      id,
      status: "awaiting_approval",
      createdAt: now,
      updatedAt: now,
      planningInput,
      plan,
      branch: null,
      workspace: null,
      repositoryInspection: null,
      implementation: null,
      diff: null,
      validation: null,
      review: null,
      pullRequest: null,
      ciStatus: null,
      issueComments: [],
      approvals: [],
      retries: [],
      events: [
        {
          at: now,
          type: "plan_generated",
          message: "AI implementation plan generated and is awaiting human approval."
        }
      ]
    };

    this.#workflows.set(id, workflow);
    this.#save(workflow);
    return workflow;
  }

  list() {
    return [...this.#workflows.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  get(id) {
    return this.#workflows.get(id) || null;
  }

  approve(id, approval) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    if (workflow.status !== "awaiting_approval") {
      return { ok: false, reason: "workflow_not_awaiting_approval", workflow };
    }

    const now = new Date().toISOString();
    const approvalRecord = {
      at: now,
      reviewer: approval.reviewer || "unknown",
      decision: "approved",
      comment: approval.comment || ""
    };

    workflow.status = "approved";
    workflow.updatedAt = now;
    workflow.approvals.push(approvalRecord);
    workflow.events.push({
      at: now,
      type: "plan_approved",
      message: `Plan approved by ${approvalRecord.reviewer}.`
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  requestRetry(id, retry = {}) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const retryStageByStatus = {
      branch_creation_failed: "branch",
      workspace_preparation_failed: "workspace",
      repository_inspection_failed: "inspection",
      implementation_failed: "implementation",
      diff_capture_failed: "diff",
      validation_failed: "validation",
      review_failed: "review",
      pr_creation_failed: "pullRequest",
      ci_status_failed: "ciStatus"
    };
    const stage = retryStageByStatus[workflow.status];

    if (!stage) {
      return { ok: false, reason: "workflow_not_retryable", workflow };
    }

    const now = new Date().toISOString();
    const retryRecord = {
      at: now,
      reviewer: retry.reviewer || "unknown",
      stage,
      comment: retry.comment || ""
    };

    workflow.updatedAt = now;
    workflow.retries = workflow.retries || [];
    workflow.retries.push(retryRecord);
    workflow.events.push({
      at: now,
      type: "retry_requested",
      message: `Retry requested for ${stage} by ${retryRecord.reviewer}.`
    });

    this.#save(workflow);
    return { ok: true, workflow, stage };
  }

  markWorkflowQueued(id, { stage = "branch", source = "workflow" } = {}) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const now = new Date().toISOString();

    workflow.status = "queued";
    workflow.updatedAt = now;
    workflow.queuedStage = stage;
    workflow.events.push({
      at: now,
      type: "workflow_queued",
      message: `Workflow queued from ${stage} by ${source}.`
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  markIssueCommentPublished(id, comment) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const now = new Date().toISOString();

    workflow.updatedAt = now;
    workflow.issueComments = workflow.issueComments || [];
    workflow.issueComments.push({
      ...comment,
      publishedAt: now
    });
    workflow.events.push({
      at: now,
      type: "issue_comment_published",
      message: comment.created
        ? `Issue comment ${comment.url || ""} published.`.trim()
        : "Mock issue comment prepared."
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  markIssueCommentFailed(id, error) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const now = new Date().toISOString();

    workflow.updatedAt = now;
    workflow.events.push({
      at: now,
      type: "issue_comment_failed",
      message: error.message
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  markBranchCreated(id, branch) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const now = new Date().toISOString();

    workflow.status = "branch_created";
    workflow.updatedAt = now;
    workflow.branch = {
      ...branch,
      createdAt: now
    };
    workflow.events.push({
      at: now,
      type: "branch_created",
      message: `Branch ${branch.branchName} created from ${branch.baseBranch}.`
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  markBranchCreationFailed(id, error) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const now = new Date().toISOString();

    workflow.status = "branch_creation_failed";
    workflow.updatedAt = now;
    workflow.events.push({
      at: now,
      type: "branch_creation_failed",
      message: error.message
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  markWorkspacePrepared(id, workspace) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const now = new Date().toISOString();

    workflow.status = "workspace_prepared";
    workflow.updatedAt = now;
    workflow.workspace = {
      ...workspace,
      preparedAt: now
    };
    workflow.events.push({
      at: now,
      type: "workspace_prepared",
      message: `Workspace prepared at ${workspace.path}.`
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  markWorkspacePreparationFailed(id, error) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const now = new Date().toISOString();

    workflow.status = "workspace_preparation_failed";
    workflow.updatedAt = now;
    workflow.events.push({
      at: now,
      type: "workspace_preparation_failed",
      message: error.message
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  markRepositoryInspected(id, repositoryInspection) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const now = new Date().toISOString();

    workflow.status = "repository_inspected";
    workflow.updatedAt = now;
    workflow.repositoryInspection = {
      ...repositoryInspection,
      inspectedAt: now
    };
    workflow.events.push({
      at: now,
      type: "repository_inspected",
      message: repositoryInspection.inspected
        ? `Repository inspected with ${repositoryInspection.fileTree.length} files scanned.`
        : `Repository inspection skipped: ${repositoryInspection.reason}.`
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  markRepositoryInspectionFailed(id, error) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const now = new Date().toISOString();

    workflow.status = "repository_inspection_failed";
    workflow.updatedAt = now;
    workflow.events.push({
      at: now,
      type: "repository_inspection_failed",
      message: error.message
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  markImplementationCompleted(id, implementation) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const now = new Date().toISOString();

    workflow.status = "implementation_completed";
    workflow.updatedAt = now;
    workflow.implementation = {
      ...implementation,
      completedAt: now
    };
    workflow.events.push({
      at: now,
      type: "implementation_completed",
      message: implementation.applied
        ? `Implementation completed with ${implementation.changedFiles.length} changed files.`
        : "Mock implementation completed without applying code changes."
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  markImplementationFailed(id, error) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const now = new Date().toISOString();

    workflow.status = "implementation_failed";
    workflow.updatedAt = now;
    workflow.events.push({
      at: now,
      type: "implementation_failed",
      message: error.message
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  markDiffCaptured(id, diff) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const now = new Date().toISOString();

    workflow.status = "diff_captured";
    workflow.updatedAt = now;
    workflow.diff = {
      ...diff,
      capturedAt: now
    };
    workflow.events.push({
      at: now,
      type: "diff_captured",
      message: diff.captured
        ? `Diff captured with ${diff.changedFiles.length} changed files.`
        : `Diff capture skipped: ${diff.reason}.`
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  markDiffCaptureFailed(id, error) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const now = new Date().toISOString();

    workflow.status = "diff_capture_failed";
    workflow.updatedAt = now;
    workflow.events.push({
      at: now,
      type: "diff_capture_failed",
      message: error.message
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  markValidationCompleted(id, validation) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const now = new Date().toISOString();

    workflow.status = "validation_completed";
    workflow.updatedAt = now;
    workflow.validation = {
      ...validation,
      completedAt: now
    };
    workflow.events.push({
      at: now,
      type: "validation_completed",
      message: validation.summary
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  markValidationFailed(id, error) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const now = new Date().toISOString();

    workflow.status = "validation_failed";
    workflow.updatedAt = now;
    workflow.events.push({
      at: now,
      type: "validation_failed",
      message: error.message
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  markReviewCompleted(id, review) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const now = new Date().toISOString();

    workflow.status = "review_completed";
    workflow.updatedAt = now;
    workflow.review = {
      ...review,
      completedAt: now
    };
    workflow.events.push({
      at: now,
      type: "review_completed",
      message: review.summary
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  markReviewFailed(id, error) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const now = new Date().toISOString();

    workflow.status = "review_failed";
    workflow.updatedAt = now;
    workflow.events.push({
      at: now,
      type: "review_failed",
      message: error.message
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  markPullRequestCreated(id, pullRequest) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const now = new Date().toISOString();

    workflow.status = "pr_created";
    workflow.updatedAt = now;
    workflow.pullRequest = {
      ...pullRequest,
      createdAt: now
    };
    workflow.events.push({
      at: now,
      type: "pr_created",
      message: pullRequest.created
        ? `Pull request #${pullRequest.number} created.`
        : "Mock pull request prepared."
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  markCiStatusCollected(id, ciStatus) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const now = new Date().toISOString();

    workflow.status = ciStatus.passed ? "ci_passed" : "ci_pending";
    workflow.updatedAt = now;
    workflow.ciStatus = {
      ...ciStatus,
      collectedAt: now
    };
    workflow.events.push({
      at: now,
      type: workflow.status,
      message: ciStatus.summary
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  markCiStatusFailed(id, error) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const now = new Date().toISOString();

    workflow.status = "ci_status_failed";
    workflow.updatedAt = now;
    workflow.events.push({
      at: now,
      type: "ci_status_failed",
      message: error.message
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  markPullRequestCreationFailed(id, error) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    const now = new Date().toISOString();

    workflow.status = "pr_creation_failed";
    workflow.updatedAt = now;
    workflow.events.push({
      at: now,
      type: "pr_creation_failed",
      message: error.message
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }

  reject(id, rejection) {
    const workflow = this.get(id);

    if (!workflow) {
      return { ok: false, reason: "workflow_not_found" };
    }

    if (workflow.status !== "awaiting_approval") {
      return { ok: false, reason: "workflow_not_awaiting_approval", workflow };
    }

    const now = new Date().toISOString();
    const rejectionRecord = {
      at: now,
      reviewer: rejection.reviewer || "unknown",
      decision: "rejected",
      comment: rejection.comment || ""
    };

    workflow.status = "plan_rejected";
    workflow.updatedAt = now;
    workflow.approvals.push(rejectionRecord);
    workflow.events.push({
      at: now,
      type: "plan_rejected",
      message: `Plan rejected by ${rejectionRecord.reviewer}.`
    });

    this.#save(workflow);
    return { ok: true, workflow };
  }
}
