import assert from "node:assert/strict";
import { test } from "node:test";

import { loadConfig } from "../src/config.js";
import { GitHubVaultStore } from "../src/github-vault-store.js";
import { ProposalTokenSigner } from "../src/proposal-token.js";
import { VaultPathPolicy } from "../src/path-policy.js";
import { routeRequest } from "../src/routes.js";
import { VaultService } from "../src/vault-service.js";

test("config uses generic public secret names", () => {
  const config = loadConfig({
    VAULT_BRIDGE_API_KEY: "api-key",
    PROPOSAL_TOKEN_SECRET: "proposal-secret",
    GITHUB_TOKEN: "github-token",
    GITHUB_OWNER: "owner",
    GITHUB_REPO: "repo",
    GITHUB_BRANCH: "main",
  });

  assert.equal(config.apiKey, "api-key");
  assert.equal(config.github.repo, "repo");
  assert.throws(() => loadConfig({}), /missing_env:VAULT_BRIDGE_API_KEY/);
});

test("path policy rejects traversal and non markdown targets", () => {
  const policy = new VaultPathPolicy();
  assert.equal(policy.validateNotePath("folder/note.md"), "folder/note.md");
  assert.throws(() => policy.validateNotePath("../secret.md"), /path_outside_vault/);
  assert.throws(() => policy.validateNotePath("/secret.md"), /path_outside_vault/);
  assert.throws(() => policy.validateNotePath("folder/note.txt"), /markdown_required/);
});

test("proposal token binds path, base sha, and exact content digest", async () => {
  const store = new FakeVaultStore({ "note.md": { sha: "base-1", content: "# Old\n" } });
  const service = buildService(store);
  const proposal = await service.proposeNotePatch({ path: "note.md", new_content: "# New\n" });

  await assert.rejects(
    () => service.commitNotePatch({
      path: "note.md",
      base_sha: "base-1",
      new_content: "# Mutated\n",
      confirmation_token: proposal.confirmation_token,
    }),
    /proposal_token_mismatch/,
  );

  const committed = await service.commitNotePatch({
    path: "note.md",
    base_sha: "base-1",
    new_content: "# New\n",
    confirmation_token: proposal.confirmation_token,
  });

  assert.equal(committed.status, "committed");
  assert.equal(store.files["note.md"].content, "# New\n");
});

test("commit rejects stale base sha instead of overwriting", async () => {
  const store = new FakeVaultStore({ "note.md": { sha: "base-1", content: "# Old\n" } });
  const service = buildService(store);
  const proposal = await service.proposeNotePatch({ path: "note.md", new_content: "# New\n" });
  store.files["note.md"] = { sha: "base-2", content: "# Other\n" };

  await assert.rejects(
    () => service.commitNotePatch({
      path: "note.md",
      base_sha: "base-1",
      new_content: "# New\n",
      confirmation_token: proposal.confirmation_token,
    }),
    /conflict_detected/,
  );
  assert.equal(store.files["note.md"].content, "# Other\n");
});

test("commit maps storage CAS rejection to conflict", async () => {
  const store = new FakeVaultStore({ "note.md": { sha: "base-1", content: "# Old\n" } });
  const service = buildService(store);
  const proposal = await service.proposeNotePatch({ path: "note.md", new_content: "# New\n" });
  store.failCommit = Object.assign(new Error("github conflict"), { status: 409 });

  await assert.rejects(
    () => service.commitNotePatch({
      path: "note.md",
      base_sha: "base-1",
      new_content: "# New\n",
      confirmation_token: proposal.confirmation_token,
    }),
    /conflict_detected/,
  );
});

test("actions router requires api key and exposes consequential write schema", async () => {
  const service = buildService(new FakeVaultStore({}));
  const config = { apiKey: "secret" };
  const denied = await routeRequest(new Request("https://bridge.test/actions/search_notes", { method: "POST", body: "{}" }), service, config);
  assert.equal(denied.status, 401);

  const openapi = await routeRequest(new Request("https://bridge.test/openapi.json"), service, config);
  const schema = await openapi.json();
  assert.deepEqual(schema.security, [{ apiKeyAuth: [] }]);
  assert.equal(schema.components.securitySchemes.apiKeyAuth.name, "X-API-Key");
  assert.equal(schema.paths["/actions/commit_note_patch"].post["x-openai-isConsequential"], true);
  assert.equal(schema.paths["/actions/auth_probe"].post["x-openai-isConsequential"], false);
  assertResponseObjectProperties(schema, "/actions/auth_probe");
  assert.equal(schema.paths["/actions/read_note"].post["x-openai-isConsequential"], false);
  assert.equal(typeof schema.components.schemas, "object");
  assertResponseObjectProperties(schema, "/actions/search_notes");
  assertResponseObjectProperties(schema, "/actions/read_note");
  assertResponseObjectProperties(schema, "/actions/propose_note_patch");
  assertResponseObjectProperties(schema, "/actions/commit_note_patch");
});

test("auth probe reports header delivery without exposing secrets", async () => {
  const service = buildService(new FakeVaultStore({}));
  const config = { apiKey: "secret" };

  const missing = await routeRequest(
    new Request("https://bridge.test/actions/auth_probe", { method: "POST", body: "{}" }),
    service,
    config,
  );
  assert.equal(missing.status, 200);
  assert.deepEqual(await missing.json(), {
    authenticated: false,
    received_authorization: false,
    received_x_api_key: false,
    authorization_shape: "missing",
    expected_header: "X-API-Key",
  });

  const valid = await routeRequest(
    new Request("https://bridge.test/actions/auth_probe", {
      method: "POST",
      headers: { "x-api-key": "secret" },
      body: "{}",
    }),
    service,
    config,
  );
  assert.equal(valid.status, 200);
  const payload = await valid.json();
  assert.equal(payload.authenticated, true);
  assert.equal(payload.received_x_api_key, true);
  assert.equal(payload.expected_header, "X-API-Key");
  assert.equal(Object.values(payload).includes("secret"), false);
});

test("actions router accepts supported api key header variants", async () => {
  const service = buildService(new FakeVaultStore({ "note.md": { sha: "s1", content: "# Note\n" } }));
  const config = { apiKey: "secret" };

  for (const headers of [
    { authorization: "Bearer secret" },
    { authorization: "secret" },
    { "x-api-key": "secret" },
  ]) {
    const response = await routeRequest(
      new Request("https://bridge.test/actions/read_note", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ path: "note.md" }),
      }),
      service,
      config,
    );
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.path, "note.md");
  }
});

test("github store search prioritizes path matches beyond the early tree slice", async () => {
  const files = {};
  for (let index = 0; index < 60; index += 1) {
    files[`archive/import-${index}.md`] = { sha: `s-${index}`, content: "# Unrelated\n" };
  }
  files["reference/search-target.md"] = { sha: "target", content: "# Search Target\n" };
  const store = new FakeGitHubStore(files);

  const results = await store.searchNotes({ query: "search-target", pathPrefix: "", maxResults: 3 });

  assert.equal(results[0].path, "reference/search-target.md");
  assert.equal(store.reads.length, 1);
});

test("mcp adapter uses the same vault service", async () => {
  const service = buildService(new FakeVaultStore({ "a.md": { sha: "s1", content: "# A\nbody\n" } }));
  const config = { apiKey: "secret" };
  const request = new Request("https://bridge.test/mcp", {
    method: "POST",
    headers: { authorization: "Bearer secret" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "read_note", arguments: { path: "a.md" } },
    }),
  });

  const response = await routeRequest(request, service, config);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.match(payload.result.content[0].text, /# A/);
});

function buildService(store) {
  const clock = { now: () => 1000 };
  return new VaultService({
    store,
    pathPolicy: new VaultPathPolicy(),
    proposalSigner: new ProposalTokenSigner({ secret: "test-secret", ttlSeconds: 900, clock }),
    limits: { maxNoteBytes: 10000, maxSearchFiles: 50 },
    clock,
  });
}

function assertResponseObjectProperties(openapi, pathname) {
  const responseSchema = openapi.paths[pathname].post.responses["200"].content["application/json"].schema;
  assert.equal(responseSchema.type, "object");
  assert.equal(typeof responseSchema.properties, "object");
  assert.ok(Object.keys(responseSchema.properties).length > 0);
}

class FakeVaultStore {
  constructor(files) {
    this.files = { ...files };
    this.counter = 1;
  }

  async searchNotes({ query, maxResults }) {
    const q = String(query || "").toLowerCase();
    return Object.entries(this.files)
      .filter(([path, file]) => `${path}\n${file.content}`.toLowerCase().includes(q))
      .slice(0, maxResults)
      .map(([path, file]) => ({ path, sha: file.sha, title: path, excerpt: file.content.slice(0, 80) }));
  }

  async readNote(path) {
    const file = this.files[path];
    if (!file) {
      return { path, sha: null, content: "", url: "" };
    }
    return { path, sha: file.sha, content: file.content, url: `https://example.test/${path}` };
  }

  async commitNote({ path, content, baseSha }) {
    if (this.failCommit) {
      throw this.failCommit;
    }
    this.files[path] = { sha: `sha-${this.counter++}`, content };
    return { path, sha: this.files[path].sha, commitSha: `commit-${this.counter}`, url: `https://example.test/${path}`, baseSha };
  }
}

class FakeGitHubStore extends GitHubVaultStore {
  constructor(files) {
    super({ owner: "owner", repo: "repo", branch: "main", token: "token", vaultRootPrefix: "", maxSearchFiles: 100 });
    this.files = files;
    this.reads = [];
  }

  async request(path) {
    if (path.includes("/git/trees/")) {
      return {
        tree: Object.keys(this.files).map((filePath) => ({ type: "blob", path: filePath })),
      };
    }
    throw new Error(`unexpected request: ${path}`);
  }

  async readRepoPath(repoPath) {
    this.reads.push(repoPath);
    const file = this.files[repoPath];
    return { path: repoPath, sha: file.sha, content: file.content, url: `https://example.test/${repoPath}` };
  }
}
