export function dashboardHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>AI SDE Workflow</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f6f7f9;
        --panel: #ffffff;
        --ink: #1d2430;
        --muted: #697386;
        --line: #d9dee8;
        --accent: #1967d2;
        --danger: #b3261e;
        --ok: #137333;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: var(--bg);
        color: var(--ink);
        font-family: Arial, Helvetica, sans-serif;
        font-size: 14px;
      }

      header {
        border-bottom: 1px solid var(--line);
        background: var(--panel);
      }

      .wrap {
        width: min(1120px, calc(100vw - 32px));
        margin: 0 auto;
      }

      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        min-height: 64px;
      }

      h1 {
        margin: 0;
        font-size: 20px;
        font-weight: 700;
        letter-spacing: 0;
      }

      main {
        padding: 24px 0;
      }

      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
      }

      label {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--muted);
      }

      input {
        min-height: 36px;
        border: 1px solid var(--line);
        border-radius: 6px;
        padding: 0 10px;
        color: var(--ink);
        background: var(--panel);
      }

      button {
        min-height: 36px;
        border: 1px solid var(--line);
        border-radius: 6px;
        background: var(--panel);
        color: var(--ink);
        padding: 0 12px;
        cursor: pointer;
      }

      button.primary {
        border-color: var(--accent);
        background: var(--accent);
        color: #ffffff;
      }

      button.danger {
        border-color: var(--danger);
        color: var(--danger);
      }

      button:disabled {
        cursor: not-allowed;
        opacity: 0.45;
      }

      .table-shell {
        overflow-x: auto;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        border-bottom: 1px solid var(--line);
        padding: 12px;
        text-align: left;
        vertical-align: top;
      }

      th {
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
      }

      tr:last-child td {
        border-bottom: 0;
      }

      .status {
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        border-radius: 999px;
        padding: 0 8px;
        background: #edf2fa;
        color: #174ea6;
        white-space: nowrap;
      }

      .status.done {
        background: #e6f4ea;
        color: var(--ok);
      }

      .status.failed {
        background: #fce8e6;
        color: var(--danger);
      }

      .actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .empty,
      .error {
        padding: 24px;
        color: var(--muted);
      }

      .error {
        color: var(--danger);
      }

      code {
        font-family: Consolas, Monaco, monospace;
        font-size: 12px;
      }

      @media (max-width: 720px) {
        .topbar,
        .toolbar {
          align-items: stretch;
          flex-direction: column;
        }

        label {
          align-items: stretch;
          flex-direction: column;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="wrap topbar">
        <h1>AI SDE Workflow</h1>
        <button id="refresh" type="button">Refresh</button>
      </div>
    </header>
    <main class="wrap">
      <div class="toolbar">
        <label>
          Reviewer
          <input id="reviewer" value="human-reviewer" autocomplete="name">
        </label>
        <div id="summary" aria-live="polite"></div>
      </div>
      <section class="table-shell" aria-label="Workflows">
        <div id="app" class="empty">Loading workflows...</div>
      </section>
    </main>
    <script>
      const app = document.getElementById("app");
      const summary = document.getElementById("summary");
      const reviewer = document.getElementById("reviewer");

      function statusClass(status) {
        if (status.includes("failed") || status.includes("rejected")) return "failed";
        if (["pr_created", "review_completed", "validation_completed", "diff_captured", "implementation_completed", "repository_inspected", "workspace_prepared", "branch_created", "approved"].includes(status)) return "done";
        return "";
      }

      function issueTitle(workflow) {
        return workflow.planningInput?.issue?.title || "Untitled issue";
      }

      function repository(workflow) {
        return workflow.planningInput?.repository?.fullName || "unknown";
      }

      function issueNumber(workflow) {
        return workflow.planningInput?.issue?.number || "";
      }

      function html(value) {
        return String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      async function decide(id, decision) {
        const response = await fetch("/workflows/" + encodeURIComponent(id) + "/" + decision, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            reviewer: reviewer.value || "human-reviewer"
          })
        });

        if (!response.ok) {
          const body = await response.json();
          throw new Error(body.error || "Request failed");
        }

        await loadWorkflows();
      }

      function render(workflows) {
        summary.textContent = workflows.length + " workflow" + (workflows.length === 1 ? "" : "s");

        if (!workflows.length) {
          app.className = "empty";
          app.textContent = "No workflows yet.";
          return;
        }

        app.className = "";
        app.innerHTML = "<table><thead><tr><th>Issue</th><th>Repository</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody></tbody></table>";
        const tbody = app.querySelector("tbody");

        for (const workflow of workflows) {
          const canDecide = workflow.status === "awaiting_approval";
          const row = document.createElement("tr");
          row.innerHTML = \`
            <td><strong>#\${html(issueNumber(workflow))} \${html(issueTitle(workflow))}</strong><br><code>\${html(workflow.id)}</code></td>
            <td>\${html(repository(workflow))}</td>
            <td><span class="status \${html(statusClass(workflow.status))}">\${html(workflow.status)}</span></td>
            <td>\${html(new Date(workflow.updatedAt).toLocaleString())}</td>
            <td>
              <div class="actions">
                <button class="primary" data-decision="approve" data-id="\${html(workflow.id)}" \${canDecide ? "" : "disabled"}>Approve</button>
                <button class="danger" data-decision="reject" data-id="\${html(workflow.id)}" \${canDecide ? "" : "disabled"}>Reject</button>
              </div>
            </td>
          \`;
          tbody.appendChild(row);
        }
      }

      async function loadWorkflows() {
        app.className = "empty";
        app.textContent = "Loading workflows...";

        try {
          const response = await fetch("/workflows");
          const body = await response.json();
          render(body.workflows || []);
        } catch (error) {
          app.className = "error";
          app.textContent = error.message;
        }
      }

      document.getElementById("refresh").addEventListener("click", loadWorkflows);
      app.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-decision]");
        if (!button) return;
        button.disabled = true;

        try {
          await decide(button.dataset.id, button.dataset.decision);
        } catch (error) {
          app.className = "error";
          app.textContent = error.message;
        }
      });

      loadWorkflows();
    </script>
  </body>
</html>`;
}
