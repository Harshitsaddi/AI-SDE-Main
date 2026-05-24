export function parseCommandLine(commandLine) {
  const args = [];
  let current = "";
  let quote = null;

  for (let index = 0; index < commandLine.length; index += 1) {
    const char = commandLine[index];

    if ((char === "\"" || char === "'") && !quote) {
      quote = char;
      continue;
    }

    if (char === quote) {
      quote = null;
      continue;
    }

    if (/\s/.test(char) && !quote) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (quote) {
    throw new Error(`Unclosed quote in command: ${commandLine}`);
  }

  if (current) {
    args.push(current);
  }

  if (!args.length) {
    throw new Error("Validation command cannot be empty");
  }

  return {
    command: args[0],
    args: args.slice(1)
  };
}
