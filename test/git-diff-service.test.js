import test from "node:test";
import assert from "node:assert/strict";
import { captureGitDiff } from "../src/diff/gitDiffService.js";

function workflow(repositoryCheckedOut = true) {
  return {
    workspace: {
      path: "C:\\repo",
      repositoryCheckedOut
    }
  };
}

test("skips diff capture when repository is not checked out", async () => {
  const diff = await captureGitDiff({
    config: {
      diffMaxBytes: 100
    },
    workflow: workflow(false),
    commandRunner: async () => {
      throw new Error("should not run");
    }
  });

  assert.equal(diff.captured, false);
  assert.equal(diff.reason, "repository_not_checked_out");
});

test("captures empty git diff for a clean workspace", async () => {
  const calls = [];
  const diff = await captureGitDiff({
    config: {
      diffMaxBytes: 100
    },
    workflow: workflow(),
    commandRunner: async (command, args, options) => {
      calls.push({ command, args, options });
      return {
        stdout: "",
        stderr: "",
        exitCode: 0
      };
    }
  });

  assert.equal(diff.captured, true);
  assert.deepEqual(diff.changedFiles, []);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, ["status", "--porcelain"]);
});

test("captures changed files, diff stat, and truncated diff", async () => {
  const calls = [];
  const diff = await captureGitDiff({
    config: {
      diffMaxBytes: 12
    },
    workflow: workflow(),
    commandRunner: async (command, args, options) => {
      calls.push({ command, args, options });

      if (args[0] === "status") {
        return {
          stdout: " M src/app.js\n?? test/new.test.js\n",
          stderr: "",
          exitCode: 0
        };
      }

      if (args[0] === "diff" && args[1] === "--stat") {
        return {
          stdout: " src/app.js | 2 ++\n",
          stderr: "",
          exitCode: 0
        };
      }

      return {
        stdout: "diff --git a/src/app.js b/src/app.js\nlarge diff body\n",
        stderr: "",
        exitCode: 0
      };
    }
  });

  assert.deepEqual(diff.changedFiles, [
    {
      status: "M",
      path: "src/app.js"
    },
    {
      status: "??",
      path: "test/new.test.js"
    }
  ]);
  assert.equal(diff.diffStat, " src/app.js | 2 ++\n");
  assert.equal(diff.diff, "diff --git a");
  assert.equal(diff.truncated, true);
  assert.equal(calls.length, 3);
});
