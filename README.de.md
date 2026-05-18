# Serverless Vault Bridge

Serverless Markdown-Vault-Bruecke fuer ChatGPT Actions und MCP.

Sie stellt eine kleine Tool-Oberflaeche bereit: Markdown-Notizen lesen und Aenderungen ueber einen zweistufigen Proposal-Flow schreiben. GitHub wird nur dann beschrieben, wenn exakt derselbe vorgeschlagene Inhalt mit einem digest-bound confirmation token und der erwarteten base SHA uebergeben wird.

## Technische Grenze

- Runtime target: Cloudflare Workers oder ein kompatibler Web-API serverless host.
- Storage adapter: GitHub Contents API.
- Tool protocols: ChatGPT Actions OpenAPI und MCP JSON-RPC.
- File scope: relative Markdown-Pfade innerhalb des konfigurierten Vault-Roots.
- Write model: propose, review diff, commit with token and CAS.

Es ist keine Sync Engine, keine Datenbank, kein Agent Framework und kein direktes Write-API fuer riskante Automatisierung.

## Quick Start

```bash
npm install
npm test
cp wrangler.toml.example wrangler.toml
```

Diese Secrets gehoeren in den Serverless Provider, nicht ins Repository:

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

Importiere dieses Schema in ChatGPT Actions:

```text
https://<worker-host>/openapi.json
```

Nutze `X-API-Key: <key>` fuer Authentifizierung.

## Tool Flow

1. `auth_probe`: prueft, ob der Client einen passenden API key sendet, ohne den key offenzulegen.
2. `read_note`: liest eine Markdown-Datei und ihre aktuelle SHA.
3. `propose_note_patch`: uebergibt neuen Markdown-Inhalt und erhaelt diff plus confirmation token.
4. Diff pruefen.
5. `commit_note_patch`: denselben proposed content mit demselben path, base SHA und token committen.

MCP Clients nutzen dasselbe Service-Verhalten ueber `POST /mcp`.

## Fehlersemantik

- Absolute Pfade, path traversal, Backslashes und non-Markdown targets fail closed.
- `propose_note_patch` veraendert storage nie.
- Token mismatch, digest mismatch, path mismatch und base SHA mismatch fail closed.
- GitHub CAS Konflikte geben conflict errors zurueck und ueberschreiben keinen neueren Inhalt.
- `auth_probe` meldet nur den header delivery state und gibt keine secrets oder Vault-Inhalte zurueck.

## Repository-Inhalt

- `src/`: serverless runtime, routing, MCP adapter, GitHub store, path policy, proposal tokens.
- `test/`: Verhaltenstests fuer Auth, Pfadsicherheit, token binding, CAS conflict, OpenAPI schema und MCP parity.
- `wrangler.toml.example`: Deployment-template ohne secrets.
