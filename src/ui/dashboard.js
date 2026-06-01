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

      input,
      select {
        min-height: 36px;
        border: 1px solid var(--line);
        border-radius: 6px;
        padding: 0 10px;
        color: var(--ink);
        background: var(--panel);
      }

      input[type="checkbox"] {
        min-height: 0;
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

      .settings-shell {
        margin-bottom: 16px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
        padding: 16px;
      }

      .health-shell {
        margin-bottom: 16px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
        padding: 16px;
      }

      .health-list {
        display: grid;
        gap: 8px;
        margin-top: 12px;
      }

      .health-item {
        display: grid;
        grid-template-columns: 78px minmax(120px, 180px) 1fr;
        gap: 8px;
        align-items: start;
        border-top: 1px solid var(--line);
        padding-top: 8px;
      }

      .health-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 24px;
        border-radius: 999px;
        padding: 0 8px;
        font-size: 12px;
        text-transform: uppercase;
      }

      .health-badge.ok {
        background: #e6f4ea;
        color: var(--ok);
      }

      .health-badge.warn {
        background: #fef7e0;
        color: #8a5a00;
      }

      .health-badge.fail {
        background: #fce8e6;
        color: var(--danger);
      }

      .auth-shell {
        display: none;
        margin-bottom: 16px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
        padding: 12px;
      }

      .auth-shell.active {
        display: block;
      }

      .auth-form {
        display: flex;
        gap: 8px;
        align-items: end;
        flex-wrap: wrap;
      }

      .settings-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }

      .settings-header h2 {
        margin: 0;
        font-size: 16px;
        letter-spacing: 0;
      }

      .settings-grid {
        display: grid;
        grid-template-columns: minmax(150px, 0.8fr) minmax(180px, 1fr) minmax(220px, 1.3fr) auto;
        gap: 12px;
        align-items: end;
      }

      .settings-grid label {
        align-items: stretch;
        flex-direction: column;
      }

      .settings-grid .checkbox-label {
        align-items: center;
        flex-direction: row;
        min-height: 36px;
      }

      .setting-actions {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }

      .detail {
        margin-top: 16px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
      }

      .detail[hidden] {
        display: none;
      }

      .detail-header,
      .detail-section {
        border-bottom: 1px solid var(--line);
        padding: 16px;
      }

      .detail-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
      }

      .detail-section:last-child {
        border-bottom: 0;
      }

      .detail h2,
      .detail h3 {
        margin: 0;
        letter-spacing: 0;
      }

      .detail h2 {
        font-size: 18px;
      }

      .detail h3 {
        margin-bottom: 8px;
        font-size: 13px;
        text-transform: uppercase;
        color: var(--muted);
      }

      .detail-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
      }

      .kv {
        display: grid;
        gap: 4px;
      }

      .kv span {
        color: var(--muted);
        font-size: 12px;
      }

      .diff-summary {
        display: grid;
        gap: 12px;
      }

      .file-list {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .file-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 28px;
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 0 10px;
        background: #ffffff;
        max-width: 100%;
      }

      .file-pill strong {
        font-size: 12px;
      }

      .file-pill code {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .diff-pre {
        max-height: 520px;
      }

      pre {
        overflow-x: auto;
        margin: 0;
        border-radius: 6px;
        background: #f1f3f4;
        padding: 12px;
        white-space: pre-wrap;
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
      .error,
      .notice {
        padding: 24px;
        color: var(--muted);
      }

      .error {
        color: var(--danger);
      }

      .notice {
        padding: 0;
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

        label,
        .settings-header {
          align-items: stretch;
          flex-direction: column;
        }

        .settings-grid {
          grid-template-columns: 1fr;
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
      <section id="auth-shell" class="auth-shell" aria-label="Dashboard access">
        <form id="auth-form" class="auth-form">
          <label>
            Dashboard Token
            <input id="dashboard-token" type="password" autocomplete="off">
          </label>
          <button class="primary" type="submit">Unlock</button>
          <button id="clear-dashboard-token" type="button">Clear</button>
          <span id="auth-status" class="notice" aria-live="polite"></span>
        </form>
      </section>
      <section class="health-shell" aria-label="Provider health">
        <div class="settings-header">
          <h2>Readiness</h2>
          <button id="refresh-health" type="button">Check</button>
        </div>
        <div id="health-panel" class="notice" aria-live="polite">Checking readiness...</div>
      </section>
      <section class="settings-shell" aria-label="AI settings">
        <div class="settings-header">
          <h2>AI Settings</h2>
          <span id="ai-settings-status" class="notice" aria-live="polite"></span>
        </div>
        <form id="ai-settings-form" class="settings-grid">
          <label>
            Provider
            <select id="ai-provider">
              <option value="mock">Mock</option>
              <option value="openai">ChatGPT / OpenAI</option>
              <option value="anthropic">Claude / Anthropic</option>
              <option value="gemini">Gemini / Google</option>
              <option value="command">Command</option>
            </select>
          </label>
          <label>
            Model
            <input id="ai-model" list="ai-models" placeholder="Select or type a model">
            <datalist id="ai-models"></datalist>
          </label>
          <label>
            API Key
            <input id="ai-api-key" type="password" autocomplete="off" placeholder="Leave blank to keep saved key">
          </label>
          <div class="setting-actions">
            <label class="checkbox-label">
              <input id="ai-clear-key" type="checkbox">
              Clear key
            </label>
            <button class="primary" type="submit">Save</button>
          </div>
        </form>
      </section>
      <section class="table-shell" aria-label="Workflows">
        <div id="app" class="empty">Loading workflows...</div>
      </section>
      <section id="detail" class="detail" aria-label="Workflow detail" hidden></section>
    </main>
    <script>
      const app = document.getElementById("app");
      const detail = document.getElementById("detail");
      const summary = document.getElementById("summary");
      const reviewer = document.getElementById("reviewer");
      const authShell = document.getElementById("auth-shell");
      const authForm = document.getElementById("auth-form");
      const dashboardToken = document.getElementById("dashboard-token");
      const clearDashboardToken = document.getElementById("clear-dashboard-token");
      const authStatus = document.getElementById("auth-status");
      const aiSettingsForm = document.getElementById("ai-settings-form");
      const aiProvider = document.getElementById("ai-provider");
      const aiModel = document.getElementById("ai-model");
      const aiModels = document.getElementById("ai-models");
      const aiApiKey = document.getElementById("ai-api-key");
      const aiClearKey = document.getElementById("ai-clear-key");
      const aiSettingsStatus = document.getElementById("ai-settings-status");
      const healthPanel = document.getElementById("health-panel");
      const tokenStorageKey = "ai-sde-dashboard-token";
      let aiSettings = null;

      function authHeaders(headers = {}) {
        const token = localStorage.getItem(tokenStorageKey);
        return token ? { ...headers, authorization: "Bearer " + token } : headers;
      }

      async function apiFetch(url, options = {}) {
        const response = await fetch(url, {
          ...options,
          headers: authHeaders(options.headers || {})
        });

        if (response.status === 401) {
          authShell.classList.add("active");
          authStatus.textContent = "Enter DASHBOARD_TOKEN to continue.";
        }

        return response;
      }

      function statusClass(status) {
        if (status.includes("failed") || status.includes("rejected")) return "failed";
        if (["needs_clarification", "no_changes", "ci_passed", "pr_created", "review_completed", "validation_completed", "diff_captured", "implementation_completed", "repository_inspected", "workspace_prepared", "branch_created", "approved"].includes(status)) return "done";
        return "";
      }

      function isRetryable(status) {
        return [
          "branch_creation_failed",
          "workspace_preparation_failed",
          "repository_inspection_failed",
          "implementation_failed",
          "diff_capture_failed",
          "validation_failed",
          "review_failed",
          "pr_creation_failed",
          "ci_status_failed"
        ].includes(status);
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

      function jsonBlock(value) {
        return html(JSON.stringify(value ?? null, null, 2));
      }

      function compactList(values) {
        return values?.length ? values.join(", ") : "None";
      }

      function changedFileCount(diff) {
        return diff?.changedFiles?.length || 0;
      }

      function renderChangedFiles(diff) {
        const files = diff?.changedFiles || [];
        if (!files.length) {
          return '<div class="empty">No changed files captured.</div>';
        }

        return '<div class="file-list">' + files.map((file) => \`
          <span class="file-pill">
            <strong>\${html(file.status || "?")}</strong>
            <code>\${html(file.path || "")}</code>
          </span>
        \`).join("") + '</div>';
      }

      function renderDiffSection(diff) {
        const diffText = diff?.diff || "";
        const statText = diff?.diffStat || "";
        const comparison = diff?.comparison ? '<div class="kv"><span>Comparison</span><strong>' + html(diff.comparison) + '</strong></div>' : "";
        const truncated = diff?.truncated ? '<div class="kv"><span>Diff</span><strong>Truncated</strong></div>' : "";

        if (!diff?.captured) {
          return \`
            <div class="diff-summary">
              <div class="empty">\${html(diff?.reason ? "Diff capture skipped: " + diff.reason : "No diff captured.")}</div>
            </div>
          \`;
        }

        return \`
          <div class="diff-summary">
            <div class="detail-grid">
              <div class="kv"><span>Changed Files</span><strong>\${html(changedFileCount(diff))}</strong></div>
              \${comparison}
              \${truncated}
            </div>
            \${renderChangedFiles(diff)}
            <div>
              <h3>Diff Stat</h3>
              <pre>\${html(statText || "No diff stat captured.")}</pre>
            </div>
            <div>
              <h3>Patch Preview</h3>
              <pre class="diff-pre">\${html(diffText || "No patch body captured.")}</pre>
            </div>
          </div>
        \`;
      }

      function providerLabel(provider) {
        return {
          mock: "Mock",
          command: "Command",
          openai: "ChatGPT / OpenAI",
          anthropic: "Claude / Anthropic",
          gemini: "Gemini / Google"
        }[provider] || provider;
      }

      function refreshModelOptions() {
        const values = aiSettings?.modelsByProvider?.[aiProvider.value] || [];
        aiModels.innerHTML = values
          .map((model) => '<option value="' + html(model) + '"></option>')
          .join("");
      }

      function selectDefaultModelForProvider() {
        const values = aiSettings?.modelsByProvider?.[aiProvider.value] || [];
        if (values.length && !values.includes(aiModel.value)) {
          aiModel.value = values[0];
        }
      }

      function renderAiSettings(settings) {
        aiSettings = settings;
        aiProvider.value = settings.provider || "mock";
        aiModel.value = settings.model || "";
        aiApiKey.value = "";
        aiClearKey.checked = false;
        refreshModelOptions();

        const hasKey = settings.keyConfigured?.[settings.provider];
        const keyStatus = ["openai", "anthropic", "gemini"].includes(settings.provider)
          ? (hasKey ? "key configured" : "no key saved")
          : "no API key needed";
        aiSettingsStatus.textContent = providerLabel(settings.provider) + (settings.model ? " - " + settings.model : "") + " - " + keyStatus;
      }

      function renderHealth(health) {
        const checks = health?.checks || [];
        if (!checks.length) {
          healthPanel.className = "notice";
          healthPanel.textContent = "No readiness checks returned.";
          return;
        }

        healthPanel.className = "health-list";
        healthPanel.innerHTML = checks.map((item) => \`
          <div class="health-item">
            <span class="health-badge \${html(item.status)}">\${html(item.status)}</span>
            <strong>\${html(item.name)}</strong>
            <span>\${html(item.message)}</span>
          </div>
        \`).join("");
      }

      async function loadHealth() {
        healthPanel.className = "notice";
        healthPanel.textContent = "Checking readiness...";

        const response = await apiFetch("/health/providers");
        const health = await response.json();

        if (!response.ok) {
          throw new Error(health.message || health.error || "Could not load readiness checks");
        }

        renderHealth(health);
      }

      async function loadAiSettings() {
        const response = await apiFetch("/settings/ai");
        const settings = await response.json();

        if (!response.ok) {
          throw new Error(settings.error || "Could not load AI settings");
        }

        renderAiSettings(settings);
      }

      async function saveAiSettings(event) {
        event.preventDefault();
        aiSettingsStatus.textContent = "Saving...";

        const response = await apiFetch("/settings/ai", {
          method: "PUT",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            provider: aiProvider.value,
            model: aiModel.value,
            apiKey: aiApiKey.value,
            clearApiKey: aiClearKey.checked
          })
        });
        const settings = await response.json();

        if (!response.ok) {
          throw new Error(settings.message || settings.error || "Could not save AI settings");
        }

        renderAiSettings(settings);
      }

      async function decide(id, decision) {
        const response = await apiFetch("/workflows/" + encodeURIComponent(id) + "/" + decision, {
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

      async function loadWorkflowDetail(id) {
        detail.hidden = false;
        detail.innerHTML = '<div class="empty">Loading workflow detail...</div>';

        const response = await apiFetch("/workflows/" + encodeURIComponent(id));
        const workflow = await response.json();

        if (!response.ok) {
          throw new Error(workflow.error || "Could not load workflow detail");
        }

        renderDetail(workflow);
      }

      function renderDetail(workflow) {
        const issue = workflow.planningInput?.issue || {};
        const repositoryName = repository(workflow);
        const latestEvent = workflow.events?.at(-1);
        detail.innerHTML = \`
          <div class="detail-header">
            <div>
              <h2>#\${html(issue.number || "")} \${html(issue.title || "Untitled issue")}</h2>
              <p><code>\${html(workflow.id)}</code></p>
            </div>
            <button type="button" data-close-detail>Close</button>
          </div>
          <div class="detail-section">
            <h3>Overview</h3>
            <div class="detail-grid">
              <div class="kv"><span>Repository</span><strong>\${html(repositoryName)}</strong></div>
              <div class="kv"><span>Status</span><strong>\${html(workflow.status)}</strong></div>
              <div class="kv"><span>Updated</span><strong>\${html(new Date(workflow.updatedAt).toLocaleString())}</strong></div>
              <div class="kv"><span>Latest Event</span><strong>\${html(latestEvent?.message || "None")}</strong></div>
            </div>
          </div>
          <div class="detail-section">
            <h3>Plan</h3>
            <pre>\${jsonBlock(workflow.plan)}</pre>
          </div>
          <div class="detail-section">
            <h3>Repository Inspection</h3>
            <div class="detail-grid">
              <div class="kv"><span>Tech Stack</span><strong>\${html(compactList(workflow.repositoryInspection?.techStack))}</strong></div>
              <div class="kv"><span>Validation Commands</span><strong>\${html(compactList(workflow.repositoryInspection?.validationCommands))}</strong></div>
              <div class="kv"><span>Search Matches</span><strong>\${html(workflow.repositoryInspection?.searchMatches?.length || 0)}</strong></div>
            </div>
          </div>
          <div class="detail-section">
            <h3>Implementation</h3>
            <pre>\${jsonBlock(workflow.implementation)}</pre>
          </div>
          <div class="detail-section">
            <h3>Diff</h3>
            \${renderDiffSection(workflow.diff)}
          </div>
          <div class="detail-section">
            <h3>Validation</h3>
            <pre>\${jsonBlock(workflow.validation)}</pre>
          </div>
          <div class="detail-section">
            <h3>Review</h3>
            <pre>\${jsonBlock(workflow.review)}</pre>
          </div>
          <div class="detail-section">
            <h3>Pull Request</h3>
            <pre>\${jsonBlock(workflow.pullRequest)}</pre>
          </div>
          <div class="detail-section">
            <h3>CI Status</h3>
            <pre>\${jsonBlock(workflow.ciStatus)}</pre>
          </div>
        \`;
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
          const canRetry = isRetryable(workflow.status);
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
                <button data-decision="retry" data-id="\${html(workflow.id)}" \${canRetry ? "" : "disabled"}>Retry</button>
                <button data-view-workflow data-id="\${html(workflow.id)}">View</button>
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
          const response = await apiFetch("/workflows");
          const body = await response.json();
          if (!response.ok) {
            throw new Error(body.message || body.error || "Could not load workflows");
          }
          render(body.workflows || []);
        } catch (error) {
          app.className = "error";
          app.textContent = error.message;
        }
      }

      document.getElementById("refresh").addEventListener("click", loadWorkflows);
      document.getElementById("refresh-health").addEventListener("click", () => {
        loadHealth().catch((error) => {
          healthPanel.className = "error";
          healthPanel.textContent = error.message;
        });
      });
      authForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        localStorage.setItem(tokenStorageKey, dashboardToken.value);
        dashboardToken.value = "";
        authStatus.textContent = "Token saved.";
        authShell.classList.remove("active");
        await loadAiSettings();
        await loadHealth();
        await loadWorkflows();
      });
      clearDashboardToken.addEventListener("click", () => {
        localStorage.removeItem(tokenStorageKey);
        dashboardToken.value = "";
        authStatus.textContent = "Token cleared.";
      });
      aiProvider.addEventListener("change", () => {
        refreshModelOptions();
        selectDefaultModelForProvider();
      });
      aiSettingsForm.addEventListener("submit", async (event) => {
        try {
          await saveAiSettings(event);
        } catch (error) {
          aiSettingsStatus.textContent = error.message;
        }
      });
      app.addEventListener("click", async (event) => {
        const viewButton = event.target.closest("button[data-view-workflow]");
        if (viewButton) {
          try {
            await loadWorkflowDetail(viewButton.dataset.id);
          } catch (error) {
            detail.hidden = false;
            detail.innerHTML = '<div class="error">' + html(error.message) + '</div>';
          }
          return;
        }

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
      detail.addEventListener("click", (event) => {
        if (event.target.closest("button[data-close-detail]")) {
          detail.hidden = true;
          detail.innerHTML = "";
        }
      });

      loadAiSettings().catch((error) => {
        aiSettingsStatus.textContent = error.message;
      });
      loadHealth().catch((error) => {
        healthPanel.className = "error";
        healthPanel.textContent = error.message;
      });
      loadWorkflows();
    </script>
  </body>
</html>`;
}
