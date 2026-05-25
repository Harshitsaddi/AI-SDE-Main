import { parseCommandLine } from "../validation/commandLine.js";

function commandParts(commandLine) {
  const parsed = parseCommandLine(commandLine);
  return [parsed.command, ...parsed.args];
}

export function commandMatchesPrefix(commandLine, allowedPrefix) {
  const command = commandParts(commandLine);
  const prefix = commandParts(allowedPrefix);

  if (prefix.length > command.length) {
    return false;
  }

  return prefix.every((part, index) => part === command[index]);
}

export function isCommandAllowed(commandLine, allowlist = []) {
  if (!allowlist.length) {
    return true;
  }

  return allowlist.some((allowedPrefix) => commandMatchesPrefix(commandLine, allowedPrefix));
}

export function assertCommandAllowed(commandLine, allowlist = [], settingName = "COMMAND_ALLOWLIST") {
  if (!isCommandAllowed(commandLine, allowlist)) {
    throw new Error(`Command is not allowed by ${settingName}: ${commandLine}`);
  }
}
