/**
 * Installation path and shell hint utilities.
 */

import os from "node:os";
import path from "node:path";
import process from "node:process";

export function getManagedInstallDir() {
  if (process.platform === "win32") {
    return process.env.LOCALAPPDATA && process.env.LOCALAPPDATA.trim() !== ""
      ? path.join(process.env.LOCALAPPDATA, "Programs", "bgm-cli")
      : path.join(os.homedir(), "AppData", "Local", "Programs", "bgm-cli");
  }

  return path.join(os.homedir(), ".local", "share", "bgm-cli");
}

export function getShellReloadHint() {
  if (process.platform === "win32") {
    return "Restart PowerShell or CMD, then run `bgm --help`.";
  }

  const shell = process.env.SHELL ?? "";
  if (shell.includes("zsh")) {
    return "Run `source ~/.zshrc`, then run `bgm --help`.";
  }
  if (shell.includes("bash")) {
    return "Run `source ~/.bashrc`, then run `bgm --help`.";
  }
  return "Reload your shell configuration, then run `bgm --help`.";
}

export function getUpdateShellHint() {
  if (process.platform === "win32") {
    return "Restart PowerShell or CMD if the old process is still open, then run `bgm --help`.";
  }

  return "Open a new shell if the current process still holds the old script, then run `bgm --help`.";
}
