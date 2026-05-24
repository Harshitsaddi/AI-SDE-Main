export class WorkflowStore {
  #workflows = new Map();
  #onChange = null;

  constructor({ workflows = [], onChange = null } = {}) {
    this.#onChange = onChange;

    for (const workflow of workflows) {
      this.#workflows.set(workflow.id, workflow);
    }
  }

  #save() {
    if (this.#onChange) {
      this.#onChange(this.list());
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
      approvals: [],
      events: [
        {
          at: now,
          type: "plan_generated",
          message: "AI implementation plan generated and is awaiting human approval."
        }
      ]
    };

    this.#workflows.set(id, workflow);
    this.#save();
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

    this.#save();
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

    this.#save();
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

    this.#save();
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

    this.#save();
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

    this.#save();
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

    this.#save();
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

    this.#save();
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

    this.#save();
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

    this.#save();
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

    this.#save();
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

    this.#save();
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

    this.#save();
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

    this.#save();
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

    this.#save();
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

    this.#save();
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

    this.#save();
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

    this.#save();
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

    this.#save();
    return { ok: true, workflow };
  }
}
