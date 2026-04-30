/**
 * TUI interactive primitives (menus, prompts, wait-for-continue).
 */

import process from "node:process";
import { emitKeypressEvents } from "node:readline";
import { CommandError } from "../core/output.js";
import { askOptional, askRequired } from "./prompts.js";
import {
  drawDivider,
  drawSectionTitle,
  inverse,
  renderTuiHeader,
  renderTuiInputScreen,
} from "./tui-render.js";

export async function askMenuChoice(label, choices, defaultValue, extras = {}) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    const fallbackChoice = choices.find(
      (choice) => choice.value === defaultValue || choice.key === defaultValue,
    ) ?? choices[0];
    return fallbackChoice?.value;
  }

  emitKeypressEvents(process.stdin);
  const options = choices.map((choice) => ({
    ...choice,
    selected: choice.value === defaultValue || choice.key === defaultValue,
  }));
  const directKeys = options
    .map((choice) => choice.key)
    .filter((choiceKey) => choiceKey !== undefined && choiceKey !== null && choiceKey !== "");
  let index = Math.max(0, options.findIndex((choice) => choice.selected));
  if (index === -1) {
    index = 0;
  }
  let keyBuffer = "";

  return new Promise((resolve, reject) => {
    const wasRaw = Boolean(process.stdin.isRaw);
    const quitValue = extras.quitValue ?? "back";
    const quitLabel = extras.quitLabel ?? (quitValue === "exit" ? "exit" : "back");

    const cleanup = () => {
      process.stdin.off("keypress", onKeypress);
      if (!wasRaw && process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
    };

    const render = () => {
      renderTuiHeader();
      console.log(drawSectionTitle(label));
      console.log(drawDivider());
      if (extras.summary) {
        console.log(extras.summary);
        console.log(drawDivider());
      }
      for (let i = 0; i < options.length; i += 1) {
        const prefix = i === index ? "›" : " ";
        const line = `${prefix} ${options[i].label}`;
        console.log(i === index ? inverse(line) : line);
      }
      console.log("");
      console.log(drawDivider());
      const keyHint = keyBuffer ? `  typed: ${keyBuffer}` : "";
      console.log(`↑/↓ move  digits jump  Enter confirm  q ${quitLabel}${keyHint}`);
    };

    const onKeypress = (_str, key = {}) => {
      if (key.name === "up" || key.name === "k") {
        keyBuffer = "";
        index = index > 0 ? index - 1 : options.length - 1;
        render();
        return;
      }
      if (key.name === "down" || key.name === "j") {
        keyBuffer = "";
        index = index < options.length - 1 ? index + 1 : 0;
        render();
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        cleanup();
        if (keyBuffer) {
          const exactMatch = options.find((choice) => choice.key === keyBuffer);
          if (exactMatch) {
            resolve(exactMatch.value);
            return;
          }
        }
        resolve(options[index].value);
        return;
      }
      if (key.name === "q" || key.name === "escape") {
        keyBuffer = "";
        cleanup();
        resolve(quitValue);
        return;
      }
      if (key.name === "backspace" || key.name === "delete") {
        keyBuffer = keyBuffer.slice(0, -1);
        render();
        return;
      }
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new CommandError("TUI cancelled."));
        return;
      }

      const raw = typeof _str === "string" ? _str : "";
      if (/^[0-9]$/.test(raw)) {
        const nextBuffer = `${keyBuffer}${raw}`;
        const exactMatch = options.find((choice) => choice.key === nextBuffer);
        const prefixMatches = directKeys.filter((choiceKey) => String(choiceKey).startsWith(nextBuffer));

        if (prefixMatches.length > 0) {
          keyBuffer = nextBuffer;
          if (exactMatch) {
            index = options.findIndex((choice) => choice.key === nextBuffer);
            if (prefixMatches.length === 1) {
              cleanup();
              resolve(exactMatch.value);
              return;
            }
          }
          render();
          return;
        }

        const singleDigitMatch = options.find((choice) => choice.key === raw);
        if (singleDigitMatch) {
          keyBuffer = raw;
          index = options.findIndex((choice) => choice.key === raw);
          render();
        }
      }
    };

    if (!wasRaw && process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.on("keypress", onKeypress);
    render();
  });
}

export async function waitForTuiContinue() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return;
  }

  console.log("");
  console.log(drawDivider());
  console.log("Press Enter to continue.");

  emitKeypressEvents(process.stdin);

  await new Promise((resolve, reject) => {
    const wasRaw = Boolean(process.stdin.isRaw);

    const cleanup = () => {
      process.stdin.off("keypress", onKeypress);
      if (!wasRaw && process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
    };

    const onKeypress = (_str, key = {}) => {
      if (key.name === "return" || key.name === "enter" || key.name === "space") {
        cleanup();
        resolve();
        return;
      }
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new CommandError("TUI cancelled."));
      }
    };

    if (!wasRaw && process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.on("keypress", onKeypress);
  });
}

export async function askTuiOptional(rl, label, defaultValue = "", description = "") {
  renderTuiInputScreen(label, defaultValue, description);
  return askOptional(rl, label, defaultValue);
}

export async function askTuiRequired(rl, label, defaultValue = "", description = "") {
  renderTuiInputScreen(label, defaultValue, description);
  return askRequired(rl, label, defaultValue);
}
