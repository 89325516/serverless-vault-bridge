export function loadConfig(env) {
  const apiKey = required(env, "VAULT_BRIDGE_API_KEY");
  const proposalTokenSecret = required(env, "PROPOSAL_TOKEN_SECRET");
  const github = {
    token: required(env, "GITHUB_TOKEN"),
    owner: required(env, "GITHUB_OWNER"),
    repo: required(env, "GITHUB_REPO"),
    branch: required(env, "GITHUB_BRANCH"),
    vaultRootPrefix: optional(env, "VAULT_ROOT_PREFIX"),
  };
  return {
    apiKey,
    proposalTokenSecret,
    github,
    maxNoteBytes: numberValue(env.MAX_NOTE_BYTES, 240000),
    maxSearchFiles: numberValue(env.MAX_SEARCH_FILES, 80),
    proposalTtlSeconds: numberValue(env.PROPOSAL_TTL_SECONDS, 900),
  };
}

function required(env, key) {
  const value = String(env?.[key] ?? "").trim();
  if (!value) {
    throw new Error(`missing_env:${key}`);
  }
  return value;
}

function optional(env, key) {
  return String(env?.[key] ?? "").trim();
}

function numberValue(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
