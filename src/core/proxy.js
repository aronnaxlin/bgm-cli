import { ProxyAgent, setGlobalDispatcher } from "undici";

let installedProxy = null;

export function resolveProxyUrl(config) {
  const fromConfig = typeof config?.proxy === "string" ? config.proxy.trim() : "";
  if (fromConfig) {
    return { url: fromConfig, source: "config" };
  }

  const envCandidates = [
    ["HTTPS_PROXY", process.env.HTTPS_PROXY],
    ["https_proxy", process.env.https_proxy],
    ["HTTP_PROXY", process.env.HTTP_PROXY],
    ["http_proxy", process.env.http_proxy],
  ];

  for (const [name, value] of envCandidates) {
    if (typeof value === "string" && value.trim() !== "") {
      return { url: value.trim(), source: `env:${name}` };
    }
  }

  return { url: "", source: "none" };
}

export function installProxyFromConfig(config) {
  const { url, source } = resolveProxyUrl(config);
  if (!url) {
    installedProxy = null;
    return null;
  }

  try {
    setGlobalDispatcher(new ProxyAgent(url));
    installedProxy = { url, source };
    return installedProxy;
  } catch (error) {
    installedProxy = null;
    throw new Error(`Failed to install proxy ${url}: ${error?.message ?? error}`);
  }
}

export function getInstalledProxy() {
  return installedProxy;
}
