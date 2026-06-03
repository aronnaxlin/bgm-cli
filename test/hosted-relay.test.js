import { describe, it } from "node:test";
import assert from "node:assert";
import { startHostedRelayReceiver } from "../src/utils/auth-flow.js";

describe("hosted relay receiver", () => {
  it("should expose a browser-fetchable localhost callback with CORS and PNA headers", async () => {
    const relay = await startHostedRelayReceiver({
      kind: "turnstile",
      timeoutMs: 5000,
    });

    try {
      assert.match(relay.callbackUrl, /^http:\/\/127\.0\.0\.1:\d+\/callback$/);

      const preflight = await fetch(relay.callbackUrl, {
        method: "OPTIONS",
        headers: {
          Origin: "https://oauth-backend-jet.vercel.app",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Private-Network": "true",
        },
      });

      assert.strictEqual(preflight.status, 204);
      assert.strictEqual(
        preflight.headers.get("access-control-allow-origin"),
        "https://oauth-backend-jet.vercel.app",
      );
      assert.strictEqual(preflight.headers.get("access-control-allow-private-network"), "true");

      const responsePromise = fetch(relay.callbackUrl, {
        method: "POST",
        headers: {
          Origin: "https://oauth-backend-jet.vercel.app",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          turnstileToken: "turnstile-token",
        }),
      });

      const [response, payload] = await Promise.all([
        responsePromise,
        relay.completion,
      ]);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(payload.turnstileToken, "turnstile-token");
    } finally {
      relay.close();
    }
  });
});
