import { spawn } from "node:child_process";

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

export function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ? { ...process.env, ...options.env } : process.env,
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
      reject(error);
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
