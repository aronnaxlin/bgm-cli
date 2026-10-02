/**
 * Single source of truth for the CLI version at runtime.
 *
 * The released version lives in git tags (vX.Y.Z). The release workflow stamps
 * it into package.json right before `npm publish`, so a published package
 * always reports its real version. A source checkout reports the placeholder
 * committed to package.json, like a dev build.
 */

import { readFileSync } from "node:fs";

export const DEV_VERSION = "0.0.0-dev";

function readPackageVersion() {
  try {
    const raw = readFileSync(new URL("../../package.json", import.meta.url), "utf8");
    const version = JSON.parse(raw).version;
    return typeof version === "string" && version ? version : DEV_VERSION;
  } catch {
    return DEV_VERSION;
  }
}

export const APP_VERSION = readPackageVersion();
