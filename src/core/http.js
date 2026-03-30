export class BangumiApiError extends Error {
  constructor(message, { status, details } = {}) {
    super(message);
    this.name = "BangumiApiError";
    this.status = status;
    this.details = details;
  }
}

export async function requestJson(url, options = {}) {
  const targetUrl = new URL(url);

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    targetUrl.searchParams.set(key, String(value));
  }

  const requestBody = buildRequestBody(options);

  const response = await fetch(targetUrl, {
    method: options.method ?? "GET",
    headers: options.headers,
    body: requestBody,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    throw new BangumiApiError(extractErrorMessage(payload, response.statusText), {
      status: response.status,
      details: payload,
    });
  }

  return payload;
}

function buildRequestBody(options) {
  if (options.form !== undefined) {
    return new URLSearchParams(cleanObject(options.form)).toString();
  }

  if (options.body !== undefined) {
    return JSON.stringify(cleanObject(options.body));
  }

  return undefined;
}

function cleanObject(input) {
  if (input === null || input === undefined) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(cleanObject);
  }

  if (typeof input !== "object") {
    return input;
  }

  return Object.fromEntries(
    Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, cleanObject(value)]),
  );
}

function extractErrorMessage(payload, fallback) {
  if (typeof payload === "string" && payload.trim() !== "") {
    return payload;
  }

  if (payload && typeof payload === "object") {
    if (typeof payload.description === "string") {
      return payload.description;
    }
    if (typeof payload.error === "string") {
      return payload.error;
    }
    if (typeof payload.title === "string") {
      return payload.title;
    }
    if (Array.isArray(payload) && payload.length > 0) {
      return payload[0]?.msg ?? fallback;
    }
  }

  return fallback || "Request failed";
}
