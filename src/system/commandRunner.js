import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export class CommandError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "CommandError";
    this.command = details.command;
    this.args = details.args;
    this.cwd = details.cwd;
    this.exitCode = details.exitCode;
    this.stdout = details.stdout;
    this.stderr = details.stderr;
    this.timedOut = details.timedOut || false;
  }
}

function hasPathSeparator(command) {
  return command.includes("/") || command.includes("\\");
}

function isExecutableFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function resolveCommandForSpawn(command, env = process.env, platform = process.platform) {
  if (platform !== "win32" || hasPathSeparator(command) || path.extname(command)) {
    return command;
  }

  const pathEntries = String(env.PATH || env.Path || "")
    .split(path.delimiter)
    .filter(Boolean);
  const pathExts = String(env.PATHEXT || ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .filter(Boolean);

  for (const pathEntry of pathEntries) {
    for (const extension of pathExts) {
      const candidate = path.join(pathEntry, `${command}${extension.toLowerCase()}`);
      if (isExecutableFile(candidate)) {
        return candidate;
      }

      const upperCandidate = path.join(pathEntry, `${command}${extension.toUpperCase()}`);
      if (isExecutableFile(upperCandidate)) {
        return upperCandidate;
      }
    }
  }

  return command;
}

function spawnFailureMessage(command, args, error) {
  if (error?.code === "ENOENT") {
    return [
      `Command not found: ${command} ${args.join(" ")}`.trim(),
      "Make sure the executable is installed and available on PATH for the AI SDE server process.",
      "On Windows, restart the terminal/service after installing Node.js so npm.cmd is visible."
    ].join(" ");
  }

  return `Command failed to start: ${command} ${args.join(" ")}`.trim();
}

export function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const env = options.env ? { ...process.env, ...options.env } : process.env;
    const spawnCommand = resolveCommandForSpawn(command, env);
    const child = spawn(spawnCommand, args, {
      cwd: options.cwd,
      env,
      shell: false,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = options.timeoutMs
      ? setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, options.timeoutMs)
      : null;

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (timeout) clearTimeout(timeout);
      reject(new CommandError(spawnFailureMessage(command, args, error), {
        command,
        args,
        cwd: options.cwd || process.cwd(),
        exitCode: null,
        stdout,
        stderr: spawnFailureMessage(command, args, error),
        timedOut
      }));
    });

    child.on("close", (exitCode) => {
      if (timeout) clearTimeout(timeout);
      const result = {
        command,
        args,
        cwd: options.cwd || process.cwd(),
        exitCode,
        stdout,
        stderr,
        timedOut
      };

      if (exitCode === 0 && !timedOut) {
        resolve(result);
        return;
      }

      const message = timedOut
        ? `Command timed out: ${command} ${args.join(" ")}`
        : `Command failed: ${command} ${args.join(" ")}`;
      reject(new CommandError(message, result));
    });
  });
}
