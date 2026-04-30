/**
 * Interactive prompt utilities.
 */

import { CommandError } from "../core/output.js";

export async function askRequired(rl, label, defaultValue) {
  const value = await askOptional(rl, label, defaultValue);
  if (!value) {
    throw new CommandError(`Missing required value: ${label}`);
  }
  return value;
}

export async function askOptional(rl, label, defaultValue) {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = await rl.question(`${label}${suffix}: `);
  const value = answer.trim();
  if (value) {
    return value;
  }
  return defaultValue ?? "";
}

export async function askChoice(rl, label, choices, defaultKey) {
  console.log(`${label}:`);
  for (const choice of choices) {
    console.log(`  ${choice.key}. ${choice.label}`);
  }

  const answer = await askOptional(rl, "Choose", defaultKey);
  const normalized = String(answer).trim() || defaultKey;
  const matched = choices.find(
    (choice) =>
      choice.key === normalized || choice.value === normalized.toLowerCase(),
  );

  if (!matched) {
    throw new CommandError(`Invalid option: ${answer}`);
  }

  return matched.value;
}
