/**
 * Auth-related utilities shared across the CLI.
 */

import { CommandError } from "../core/output.js";

export function createState() {
  return `bgm-cli-${Date.now().toString(36)}`;
}

export function fallbackUserAgent(config) {
  const developerId = deriveDeveloperId(config);
  const appName = config.appName ?? "bgm-cli";
  const version = config.appVersion ?? "0.1.8";
  const homepageLink = config.homepageLink;

  let userAgent = developerId
    ? `${developerId}/${appName}/${version}`
    : `${appName}/${version}`;

  if (homepageLink) {
    userAgent += ` (${homepageLink})`;
  }

  return userAgent;
}

export function deriveDeveloperId(config) {
  if (config.developerId) {
    return config.developerId;
  }

  if (config.homepageLink) {
    const githubMatch = String(config.homepageLink).match(/^https?:\/\/github\.com\/([^/]+)/i);
    if (githubMatch) {
      return githubMatch[1];
    }
  }

  return null;
}

export function isLocalRedirectUri(redirectUri) {
  try {
    const url = new URL(redirectUri);
    return ["127.0.0.1", "localhost"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function extractAuthorizationInput(rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) {
    return { kind: "none", value: "" };
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    const url = new URL(value);
    const code = url.searchParams.get("code");
    if (!code) {
      throw new CommandError("Callback URL does not contain a code query parameter.");
    }
    return { kind: "code", value: code };
  }

  return { kind: "code", value };
}

export function getPrivateDemoLoginUrl() {
  return "https://next.bgm.tv/demo/login?backTo=/demo/";
}

export function extractPrivateSessionId(rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) {
    return "";
  }

  const cookieMatch = value.match(/(?:^|[;\s])chiiNextSessionID=([^;\s]+)/);
  if (cookieMatch?.[1]) {
    return cookieMatch[1].trim();
  }

  if (!value.includes("=") && !value.includes(";")) {
    return value;
  }

  return "";
}
