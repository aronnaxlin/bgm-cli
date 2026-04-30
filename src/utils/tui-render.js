/**
 * TUI rendering utilities.
 */

import path from "node:path";
import { getConfigFilePath } from "../core/config.js";

export function renderTuiHeader() {
  clearScreen();
  const width = 72;
  console.log(drawBoxLine("top", width));
  console.log(drawBoxText("bgm-cli TUI", width));
  console.log(drawBoxLine("mid", width));
  console.log(drawBoxText(`Config: ${path.basename(getConfigFilePath())}`, width));
  console.log(drawBoxText("Hints: see footer", width));
  console.log(drawBoxLine("bottom", width));
  console.log("");
}

export function renderTuiInputScreen(label, defaultValue, description) {
  renderTuiHeader();
  console.log(drawSectionTitle(label));
  console.log(drawDivider());
  if (description) {
    console.log(description);
    console.log("");
  }
  if (defaultValue !== undefined && defaultValue !== null && defaultValue !== "") {
    console.log(`Press Enter to use the default value: ${defaultValue}`);
  } else {
    console.log("Type a value and press Enter.");
  }
  console.log("");
}

export function isTuiBackAction(value) {
  return value === "back" || value === "exit";
}

export function clearScreen() {
  process.stdout.write("\x1Bc");
}

export function inverse(value) {
  return `\x1b[7m${value}\x1b[0m`;
}

export function drawDivider(width = 72) {
  return "─".repeat(width);
}

export function drawSectionTitle(title) {
  return `[ ${title} ]`;
}

export function drawBoxLine(position, width) {
  const inner = "─".repeat(Math.max(0, width - 2));
  switch (position) {
    case "top":
      return `┌${inner}┐`;
    case "mid":
      return `├${inner}┤`;
    case "bottom":
      return `└${inner}┘`;
    default:
      return `│${inner}│`;
  }
}

export function drawBoxText(text, width) {
  const innerWidth = Math.max(0, width - 2);
  const value = String(text);
  const clipped = value.length > innerWidth ? `${value.slice(0, innerWidth - 3)}...` : value;
  return `│${clipped.padEnd(innerWidth, " ")}│`;
}

export function renderTuiResultScreen(title, content, summary = "") {
  renderTuiHeader();
  console.log(drawSectionTitle(title));
  console.log(drawDivider());
  if (summary) {
    console.log(summary);
    console.log(drawDivider());
  }
  console.log(content);
}
