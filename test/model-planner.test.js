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
