const BANGUMI_PRIVATE_BASE_URL = "https://next.bgm.tv";

export function createTurnstileAuthorizeUrl(config, redirectUri) {
  const url = new URL(`${BANGUMI_PRIVATE_BASE_URL}/p1/turnstile`);
  url.searchParams.set("redirect_uri", redirectUri);
  if (config.turnstileTheme) {
    url.searchParams.set("theme", config.turnstileTheme);
  }
  return url.toString();
}
