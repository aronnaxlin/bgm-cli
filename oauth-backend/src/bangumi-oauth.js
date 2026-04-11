const BANGUMI_OAUTH_BASE_URL = "https://bgm.tv";

export function createAuthorizeUrl(config, state) {
  const url = new URL(`${BANGUMI_OAUTH_BASE_URL}/oauth/authorize`);
  url.searchParams.set("client_id", config.bgmClientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", config.bgmRedirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeAuthorizationCode(config, code) {
  const response = await fetch(`${BANGUMI_OAUTH_BASE_URL}/oauth/access_token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "bgm-cli-oauth-backend/0.1.1",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: config.bgmClientId,
      client_secret: config.bgmClientSecret,
      code,
      redirect_uri: config.bgmRedirectUri,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error_description || payload?.error || `Bangumi OAuth failed with ${response.status}`;
    throw new Error(message);
  }

  return payload;
}
