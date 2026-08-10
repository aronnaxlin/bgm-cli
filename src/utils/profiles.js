import process from "node:process";
import { AUTH_CONFIG_KEYS } from "../core/config.js";
import { CommandError } from "../core/output.js";
import { hasSavedConfigValue, previewToken } from "./helpers.js";

export const PROFILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;

const AUTH_ENV_OVERRIDE_NAMES = [
  "BGM_ACCESS_TOKEN",
  "BGM_REFRESH_TOKEN",
  "BGM_PRIVATE_SESSION_ID",
  "BGM_CLIENT_ID",
  "BGM_CLIENT_SECRET",
  "BGM_REDIRECT_URI",
];

export function validateProfileName(name) {
  const value = typeof name === "string" ? name.trim() : "";
  if (!PROFILE_NAME_PATTERN.test(value)) {
    throw new CommandError(
      `Invalid profile name: ${String(name ?? "")}. Names must match [A-Za-z0-9][A-Za-z0-9._-]{0,31}.`,
    );
  }
  return value;
}

export function pickAuthSnapshot(source) {
  const snapshot = {};
  if (!isPlainObject(source)) {
    return snapshot;
  }
  for (const key of AUTH_CONFIG_KEYS) {
    if (source[key] !== undefined) {
      snapshot[key] = source[key];
    }
  }
  return snapshot;
}

export function snapshotHasCredentials(snapshot) {
  return hasSavedConfigValue(snapshot?.accessToken) || hasSavedConfigValue(snapshot?.privateSessionId);
}

export function computeProfileSave(rawConfig, name, { force = false } = {}) {
  const profileName = validateProfileName(name);
  const profiles = readProfilesMap(rawConfig);
  const snapshot = pickAuthSnapshot(rawConfig);
  if (!snapshotHasCredentials(snapshot)) {
    throw new CommandError(
      "No saved auth credentials to snapshot. Run `bgm auth login` or `bgm auth set-token` first.",
    );
  }
  const activeProfile = readActiveProfile(rawConfig);
  if (hasProfile(profiles, profileName) && profileName !== activeProfile && !force) {
    throw new CommandError(`Profile already exists: ${profileName}. Pass --force to overwrite it.`);
  }
  return {
    set: {
      profiles: { ...profiles, [profileName]: snapshot },
      activeProfile: profileName,
    },
    remove: [],
    profile: profileName,
  };
}

export function computeProfileSwitch(rawConfig, name, { force = false } = {}) {
  const profileName = validateProfileName(name);
  const profiles = readProfilesMap(rawConfig);
  if (!hasProfile(profiles, profileName)) {
    throw profileNotFoundError(profileName, profiles);
  }
  if (!snapshotHasCredentials(pickAuthSnapshot(profiles[profileName]))) {
    throw new CommandError(
      `Profile has no saved credentials: ${profileName}. Switching to it would leave you signed out; run \`bgm auth profile delete ${profileName}\` and save it again.`,
    );
  }
  const activeProfile = readActiveProfile(rawConfig);
  const currentSnapshot = pickAuthSnapshot(rawConfig);
  const syncedPrevious = Boolean(activeProfile) && snapshotHasCredentials(currentSnapshot);
  if (!syncedPrevious && snapshotHasCredentials(currentSnapshot) && !force
    && !isSnapshotSavedIn(profiles, currentSnapshot)) {
    throw new CommandError(
      "The current credentials are not stored in any profile, and no active profile is set to sync them back into; switching would discard them. Run `bgm auth profile save <name>` first, or pass --force to discard them.",
    );
  }
  const nextProfiles = { ...profiles };
  if (syncedPrevious) {
    nextProfiles[activeProfile] = currentSnapshot;
  }
  const targetSnapshot = pickAuthSnapshot(nextProfiles[profileName]);
  const remove = AUTH_CONFIG_KEYS.filter((key) => targetSnapshot[key] === undefined);
  return {
    set: {
      ...targetSnapshot,
      profiles: nextProfiles,
      activeProfile: profileName,
    },
    remove,
    profile: profileName,
    previousProfile: activeProfile || null,
    syncedPrevious,
  };
}

export function computeProfileDelete(rawConfig, name) {
  const profileName = validateProfileName(name);
  const profiles = readProfilesMap(rawConfig);
  if (!hasProfile(profiles, profileName)) {
    throw profileNotFoundError(profileName, profiles);
  }
  const nextProfiles = { ...profiles };
  delete nextProfiles[profileName];
  const wasActive = readActiveProfile(rawConfig) === profileName;
  return {
    set: { profiles: nextProfiles },
    remove: wasActive ? ["activeProfile"] : [],
    profile: profileName,
    wasActive,
  };
}

export function buildProfileListPayload(rawConfig, { configFile, envOverrides = [], profileOverride = null } = {}) {
  const profilesMap = readProfilesMap(rawConfig);
  const activeProfile = readActiveProfile(rawConfig) || null;
  const profiles = Object.keys(profilesMap).sort().map((name) => {
    const snapshot = pickAuthSnapshot(profilesMap[name]);
    const accessTokenSaved = hasSavedConfigValue(snapshot.accessToken);
    const privateSessionSaved = hasSavedConfigValue(snapshot.privateSessionId);
    return {
      name,
      active: name === activeProfile,
      accessTokenSaved,
      accessTokenPreview: accessTokenSaved ? previewToken(snapshot.accessToken) : null,
      refreshTokenSaved: hasSavedConfigValue(snapshot.refreshToken),
      privateSessionSaved,
      privateSessionPreview: privateSessionSaved ? previewToken(snapshot.privateSessionId) : null,
      privateSessionUpdatedAt: snapshot.privateSessionUpdatedAt ?? null,
    };
  });
  return {
    resource: "auth-profile-list",
    configFile: configFile ?? null,
    activeProfile,
    activeProfileMissing: Boolean(activeProfile && !hasProfile(profilesMap, activeProfile)),
    ...(profileOverride ? { profileOverride } : {}),
    envOverrides,
    profiles,
  };
}

export function listAuthEnvOverrides(env = process.env) {
  return AUTH_ENV_OVERRIDE_NAMES.filter((envName) => {
    const value = env[envName];
    return typeof value === "string" && value.trim() !== "";
  });
}

function readProfilesMap(rawConfig) {
  const profiles = rawConfig?.profiles;
  if (!isPlainObject(profiles)) {
    return {};
  }
  const result = {};
  for (const [name, snapshot] of Object.entries(profiles)) {
    if (isPlainObject(snapshot)) {
      result[name] = snapshot;
    }
  }
  return result;
}

function hasProfile(profiles, name) {
  return Object.hasOwn(profiles, name);
}

function isSnapshotSavedIn(profiles, snapshot) {
  return Object.values(profiles).some((saved) => sameCredentials(pickAuthSnapshot(saved), snapshot));
}

function sameCredentials(left, right) {
  return credentialValue(left.accessToken) === credentialValue(right.accessToken)
    && credentialValue(left.privateSessionId) === credentialValue(right.privateSessionId);
}

function credentialValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readActiveProfile(rawConfig) {
  return typeof rawConfig?.activeProfile === "string" ? rawConfig.activeProfile.trim() : "";
}

function profileNotFoundError(name, profilesMap) {
  const names = Object.keys(profilesMap).sort();
  return new CommandError(
    `Profile not found: ${name}. Saved profiles: ${names.length > 0 ? names.join(", ") : "(none)"}`,
  );
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
