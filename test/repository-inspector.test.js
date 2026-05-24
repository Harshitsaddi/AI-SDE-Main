import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { inspectLocalRepository } from "../src/inspection/repositoryInspector.js";

async function createSampleRepo() {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-sde-inspect-"));
  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(root, "node_modules", "ignored"), { recursive: true });

  await writeFile(path.join(root, "README.md"), "# Sample App\n\nHandles login flows.\n", "utf8");
  await writeFile(path.join(root, "package.json"), JSON.stringify({
    scripts: {
      test: "node --test",
      lint: "eslint .",
      typecheck: "tsc --noEmit"
    }
  }, null, 2), "utf8");
  await writeFile(path.join(root, "tsconfig.json"), "{}", "utf8");
  await writeFile(path.join(root, "src", "auth.ts"), "export function login() { return 'avatar'; }\n", "utf8");
  await writeFile(path.join(root, "node_modules", "ignored", "index.js"), "ignored\n", "utf8");

  return root;
}

function workflow(rootPath, repositoryCheckedOut = true) {
  return {
    workspace: {
      path: rootPath,
      repositoryCheckedOut
    },
    planningInput: {
      issue: {
        title: "Fix login avatar crash",
        body: "The login flow fails when avatar data is missing."
      }
    }
  };
}

test("inspects local repository files and validation commands", async () => {
  const root = await createSampleRepo();
  const inspection = await inspectLocalRepository({
    config: {
      inspectionMaxFiles: 100
    },
    workflow: workflow(root)
  });

  assert.equal(inspection.inspected, true);
  assert.deepEqual(inspection.techStack, ["node", "typescript"]);
  assert.deepEqual(inspection.validationCommands, [
    "npm test",
    "npm run lint",
    "npm run typecheck"
  ]);
  assert.ok(inspection.fileTree.includes("src/auth.ts"));
  assert.equal(inspection.fileTree.includes("node_modules/ignored/index.js"), false);
  assert.ok(inspection.importantFiles.some((file) => file.path === "README.md"));
  assert.ok(inspection.searchMatches.some((match) => match.path === "src/auth.ts"));
});

test("skips inspection when repository is not checked out", async () => {
  const root = await createSampleRepo();
  const inspection = await inspectLocalRepository({
    config: {
      inspectionMaxFiles: 100
    },
    workflow: workflow(root, false)
  });

  assert.equal(inspection.inspected, false);
  assert.equal(inspection.reason, "repository_not_checked_out");
  assert.deepEqual(inspection.fileTree, []);
});
