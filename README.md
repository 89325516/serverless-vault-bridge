# Serverless Vault Bridge

Serverless Markdown vault bridge for ChatGPT Actions and MCP.

It exposes a small tool surface for reading Markdown notes and writing changes through a two-step proposal flow. Writes are committed to GitHub only when the caller submits the exact proposed content with a digest-bound confirmation token and the expected base SHA.

## Technical Boundary

- Runtime target: Cloudflare Workers or another Web API-compatible serverless host.
- Storage adapter: GitHub Contents API.
- Tool protocols: ChatGPT Actions OpenAPI and MCP JSON-RPC.
- File scope: relative Markdown paths inside the configured vault root.
- Write model: propose, review diff, commit with token and CAS.

It is not a sync engine, database, agent framework, or direct write API for high-risk automation.

## Quick Start

```bash
npm install
npm test
cp wrangler.toml.example wrangler.toml
```

Configure these secrets in your serverless provider, not in the repository:

```text
VAULT_BRIDGE_API_KEY
PROPOSAL_TOKEN_SECRET
GITHUB_TOKEN
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
VAULT_ROOT_PREFIX
```

Deploy:

```bash
wrangler deploy
```

Import this schema in ChatGPT Actions:

```text
https://<worker-host>/openapi.json
```

Use `X-API-Key: <key>` for authentication.

## Tool Flow

1. `auth_probe`: verify that the client sends a matching API key without exposing the key.
2. `read_note`: read a Markdown file and its current SHA.
3. `propose_note_patch`: submit new Markdown content and receive a diff plus confirmation token.
4. Review the diff.
5. `commit_note_patch`: commit the exact proposed content with the same path, base SHA, and token.

MCP clients use the same service behavior through `POST /mcp`.

## Failure Semantics

- Absolute paths, path traversal, backslashes, and non-Markdown targets fail closed.
- `propose_note_patch` never mutates storage.
- Token mismatch, digest mismatch, path mismatch, and base SHA mismatch fail closed.
- GitHub CAS conflicts return conflict errors instead of overwriting newer content.
- `auth_probe` reports header delivery state but never returns secrets or vault content.

## Repository Contents

- `src/`: serverless runtime, routing, MCP adapter, GitHub store, path policy, proposal tokens.
- `test/`: behavior tests for auth, path safety, token binding, CAS conflict handling, OpenAPI schema, and MCP parity.
- `wrangler.toml.example`: deployment template without secrets.
