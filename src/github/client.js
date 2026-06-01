export class GitHubApiError extends Error {
  constructor(message, { status, body }) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.body = body;
    this.retryAfter = null;
    this.rateLimit = null;
  }
}

function headerValue(headers, name) {
  return headers?.get?.(name) || headers?.[name] || null;
}

function rateLimitFromHeaders(headers) {
  const limit = headerValue(headers, "x-ratelimit-limit");
  const remaining = headerValue(headers, "x-ratelimit-remaining");
  const reset = headerValue(headers, "x-ratelimit-reset");

  if (!limit && !remaining && !reset) {
    return null;
  }

  return {
    limit: limit ? Number(limit) : null,
    remaining: remaining ? Number(remaining) : null,
    resetEpochSeconds: reset ? Number(reset) : null
  };
}

export function createGitHubClient({ token, apiBaseUrl = "https://api.github.com", fetchImpl = fetch }) {
  if (!token) {
    throw new Error("GITHUB_TOKEN is required for GitHub API providers");
  }

  async function request(path, options = {}) {
    const response = await fetchImpl(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
        ...(options.headers || {})
      }
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const error = new GitHubApiError(`GitHub API request failed with status ${response.status}`, {
        status: response.status,
        body
      });
      const retryAfter = headerValue(response.headers, "retry-after");
      error.retryAfter = retryAfter ? Number(retryAfter) : null;
      error.rateLimit = rateLimitFromHeaders(response.headers);
      throw error;
    }

    return body;
  }

  return {
    getRef({ owner, repo, ref }) {
      return request(`/repos/${owner}/${repo}/git/ref/${encodeURIComponent(ref)}`);
    },
    createRef({ owner, repo, ref, sha }) {
      return request(`/repos/${owner}/${repo}/git/refs`, {
        method: "POST",
        body: JSON.stringify({ ref, sha })
      });
    },
    createPullRequest({ owner, repo, title, head, base, body, draft }) {
      return request(`/repos/${owner}/${repo}/pulls`, {
        method: "POST",
        body: JSON.stringify({ title, head, base, body, draft })
      });
    },
    listPullRequests({ owner, repo, head, base, state = "open" }) {
      const params = new URLSearchParams({
        state,
        head,
        base
      });
      return request(`/repos/${owner}/${repo}/pulls?${params.toString()}`);
    },
    listCheckRunsForRef({ owner, repo, ref }) {
      return request(`/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}/check-runs`);
    },
    createIssueComment({ owner, repo, issueNumber, body }) {
      return request(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
        method: "POST",
        body: JSON.stringify({ body })
      });
    }
  };
}
