import test from "node:test";
import assert from "node:assert/strict";
import { generateModelPlan } from "../src/ai/modelPlanner.js";

function planningInput() {
  return {
    repository: {
      fullName: "acme/app",
      defaultBranch: "main"
    },
    issue: {
      number: 42,
      title: "Fix login crash",
      body: "The app crashes after login."
    }
  };
}

function planJson(provider = "model") {
  return JSON.stringify({
    provider,
    status: "plan_generated",
    issueSummary: "Fix login crash",
    proposedBranchName: "ai/issue-42",
    risk: "medium",
    affectedAreas: ["auth"],
    implementationPlan: ["Reproduce the crash", "Patch the login flow"],
    validationCommands: ["npm test"],
    humanReviewChecklist: ["Review auth behavior"]
  });
}

test("generates a plan from OpenAI-compatible chat completions", async () => {
  const calls = [];
  const plan = await generateModelPlan({
    config: {
      aiProvider: "openai",
      aiModel: "gpt-test",
      aiApiKey: "sk-test",
      secretRedactionPatterns: []
    },
    planningInput: planningInput(),
    repositoryContext: { candidateFiles: ["src/auth.js"] },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: planJson("openai")
            }
          }
        ]
      }), { status: 200 });
    }
  });

  assert.equal(plan.provider, "openai:gpt-test");
  assert.equal(plan.proposedBranchName, "ai/issue-42");
  assert.equal(calls[0].url, "https://api.openai.com/v1/chat/completions");
  assert.equal(calls[0].options.headers.authorization, "Bearer sk-test");
  const requestBody = JSON.parse(calls[0].options.body);
  const prompt = requestBody.messages[1].content;
  assert.match(prompt, /Default to returning an implementation plan/);
  assert.match(prompt, /Clarification is a last resort/);
  assert.match(prompt, /Do not ask for confirmation or permission/);
  assert.match(prompt, /multiple incompatible outcomes/);
});

test("generates a plan from Anthropic messages", async () => {
  const plan = await generateModelPlan({
    config: {
      aiProvider: "anthropic",
      aiModel: "claude-test",
      aiApiKey: "sk-ant-test",
      secretRedactionPatterns: []
    },
    planningInput: planningInput(),
    repositoryContext: { candidateFiles: [] },
    fetchImpl: async () => new Response(JSON.stringify({
      content: [
        {
          type: "text",
          text: planJson("anthropic")
        }
      ]
    }), { status: 200 })
  });

  assert.equal(plan.provider, "anthropic:claude-test");
  assert.deepEqual(plan.validationCommands, ["npm test"]);
});

test("normalizes hosted model plans when risk is missing", async () => {
  const plan = await generateModelPlan({
    config: {
      aiProvider: "gemini",
      aiModel: "gemini-test",
      aiApiKey: "gemini-key",
      secretRedactionPatterns: []
    },
    planningInput: planningInput(),
    repositoryContext: { candidateFiles: ["src/auth.js"] },
    fetchImpl: async () => new Response(JSON.stringify({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  summary: "Fix login crash",
                  branchName: "ai/fix-login-crash",
                  files: ["src/auth.js"],
                  implementationPlan: ["Patch the login flow"],
                  validationCommands: ["npm test"],
                  humanReviewChecklist: ["Review auth behavior"]
                })
              }
            ]
          }
        }
      ]
    }), { status: 200 })
  });

  assert.equal(plan.risk, "medium");
  assert.equal(plan.issueSummary, "Fix login crash");
  assert.equal(plan.proposedBranchName, "ai/fix-login-crash");
  assert.deepEqual(plan.affectedAreas, ["src/auth.js"]);
});

test("accepts hosted model clarification requests", async () => {
  const baseInput = planningInput();
  const plan = await generateModelPlan({
    config: {
      aiProvider: "openai",
      aiModel: "gpt-test",
      aiApiKey: "sk-test",
      secretRedactionPatterns: []
    },
    planningInput: {
      ...baseInput,
      issue: {
        ...baseInput.issue,
        clarificationComments: [
          {
            author: "sam",
            body: "Use plain browser JavaScript.",
            createdAt: "2026-07-21T10:00:00.000Z"
          }
        ]
      }
    },
    repositoryContext: { candidateFiles: ["app.js"] },
    fetchImpl: async () => new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              status: "needs_clarification",
              summary: "The entrypoint is unclear.",
              questions: ["Should app.js replace the existing module?"]
            })
          }
        }
      ]
    }), { status: 200 })
  });

  assert.equal(plan.status, "needs_clarification");
  assert.deepEqual(plan.clarificationQuestions, ["Should app.js replace the existing module?"]);
});

test("converts confirmation-only clarification requests into implementation plans", async () => {
  const plan = await generateModelPlan({
    config: {
      aiProvider: "openai",
      aiModel: "gpt-test",
      aiApiKey: "sk-test",
      secretRedactionPatterns: []
    },
    planningInput: planningInput(),
    repositoryContext: { candidateFiles: ["index.html", "style.css", "script.js"] },
    fetchImpl: async () => new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              status: "needs_clarification",
              summary: "Create a simple website.",
              questions: ["Please confirm if I should proceed with creating index.html, style.css, and script.js."]
            })
          }
        }
      ]
    }), { status: 200 })
  });

  assert.equal(plan.status, "plan_generated");
  assert.equal(plan.issueSummary, "Create a simple website.");
  assert.deepEqual(plan.affectedAreas, ["index.html", "style.css", "script.js"]);
  assert.deepEqual(plan.clarificationQuestions, undefined);
});

test("requires an API key for model providers", async () => {
  await assert.rejects(
    () => generateModelPlan({
      config: {
        aiProvider: "gemini",
        aiModel: "gemini-test",
        aiApiKey: "",
        secretRedactionPatterns: []
      },
      planningInput: planningInput(),
      repositoryContext: {}
    }),
    /API key is required/
  );
});
