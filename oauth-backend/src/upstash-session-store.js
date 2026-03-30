import { decryptJson, encryptJson } from "./crypto.js";

const SESSION_KEY_PREFIX = "bgm:oauth:session:";
const STATE_KEY_PREFIX = "bgm:oauth:state:";

export class UpstashSessionStore {
  constructor(config) {
    this.config = config;
  }

  async createPendingSession(session) {
    const ttlSeconds = getTtlSeconds(session.expiresAt);
    await this.pipeline([
      ["SET", this.sessionKey(session.id), JSON.stringify(session), "EX", ttlSeconds],
      ["SET", this.stateKey(session.state), session.id, "EX", ttlSeconds],
    ]);
  }

  async getSessionById(sessionId) {
    const result = await this.command(["GET", this.sessionKey(sessionId)]);
    return result ? JSON.parse(result) : null;
  }

  async getSessionByState(state) {
    const sessionId = await this.command(["GET", this.stateKey(state)]);
    if (!sessionId) {
      return null;
    }
    return this.getSessionById(sessionId);
  }

  async markAuthorized(sessionId, tokenPayload) {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      return null;
    }

    const encrypted = await encryptJson(tokenPayload, this.config.sessionEncryptionSecret);
    const next = {
      ...session,
      status: "authorized",
      authorizedAt: new Date().toISOString(),
      tokenPayload: encrypted,
      error: null,
    };

    await this.setSession(next);
    return next;
  }

  async markFailed(sessionId, errorMessage) {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      return null;
    }

    const next = {
      ...session,
      status: "failed",
      error: errorMessage,
    };

    await this.setSession(next);
    return next;
  }

  async claimAuthorizedSession(sessionId) {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      return null;
    }

    if (session.status !== "authorized" || !session.tokenPayload) {
      return {
        session,
        token: null,
      };
    }

    const token = await decryptJson(session.tokenPayload, this.config.sessionEncryptionSecret);
    await this.deleteSession(session.id, session.state);

    return {
      session,
      token,
    };
  }

  async deleteSession(sessionId, state) {
    const commands = [["DEL", this.sessionKey(sessionId)]];
    if (state) {
      commands.push(["DEL", this.stateKey(state)]);
    }
    await this.pipeline(commands);
  }

  async setSession(session) {
    const ttlSeconds = getTtlSeconds(session.expiresAt);
    await this.command(["SET", this.sessionKey(session.id), JSON.stringify(session), "EX", ttlSeconds]);
  }

  sessionKey(sessionId) {
    return `${SESSION_KEY_PREFIX}${sessionId}`;
  }

  stateKey(state) {
    return `${STATE_KEY_PREFIX}${state}`;
  }

  async command(command) {
    const [result] = await this.pipeline([command]);
    return result;
  }

  async pipeline(commands) {
    const response = await fetch(`${this.config.upstashUrl}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.upstashToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      throw new Error(`Upstash request failed with ${response.status}`);
    }

    const payload = await response.json();
    return payload.map((entry) => {
      if (entry.error) {
        throw new Error(`Upstash command failed: ${entry.error}`);
      }
      return entry.result;
    });
  }
}

function getTtlSeconds(expiresAt) {
  const seconds = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000);
  return Math.max(seconds, 1);
}
