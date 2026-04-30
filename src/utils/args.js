/**
 * CLI argument parsing utilities.
 */

export function parseGlobalArgs(argv) {
  const args = [];
  let json = false;
  let init = false;
  let version = false;

  for (const arg of argv) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--init") {
      init = true;
      continue;
    }
    if (arg === "--version" || arg === "-v") {
      version = true;
      continue;
    }
    args.push(arg);
  }

  return { args, json, init, version };
}

export function parseFlags(args) {
  const options = { _: [] };

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      options._.push(token);
      continue;
    }

    const stripped = token.slice(2);
    if (stripped.length === 0) {
      continue;
    }

    const [rawKey, inlineValue] = stripped.split("=", 2);
    const key = toCamelCase(rawKey);

    if (inlineValue !== undefined) {
      storeFlagValue(options, key, inlineValue);
      continue;
    }

    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      storeFlagValue(options, key, next);
      index += 1;
      continue;
    }

    storeFlagValue(options, key, true);
  }

  return options;
}

export function storeFlagValue(target, key, value) {
  if (target[key] === undefined) {
    target[key] = value;
    return;
  }

  if (Array.isArray(target[key])) {
    target[key].push(value);
    return;
  }

  target[key] = [target[key], value];
}

export function firstPositional(options) {
  return options._[0];
}

export function getPositional(options, index) {
  return options._[index];
}

export function ensureArray(value) {
  return Array.isArray(value) ? value : [value];
}

export function splitFilterValues(value) {
  return ensureArray(value)
    .flatMap((entry) => String(entry).split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function hasHelpFlag(args) {
  return args.includes("--help") || args.includes("-h") || args[0] === "help";
}

export function resolveHelpTarget(args) {
  const filtered = args.filter((arg) => arg !== "--help" && arg !== "-h");
  if (filtered[0] === "help") {
    return filtered[1];
  }
  return filtered[0];
}

function toCamelCase(value) {
  return String(value).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
