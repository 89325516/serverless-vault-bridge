# Serverless Vault Bridge

面向 ChatGPT Actions 和 MCP 的 serverless Markdown vault 桥接器。

它提供一组很小的工具：读取 Markdown 笔记，并通过两阶段 proposal flow 写入修改。只有调用方提交同一份 proposed content、digest-bound confirmation token 和预期 base SHA 时，才会通过 GitHub CAS 写入。

## 技术边界

- Runtime target：Cloudflare Workers 或兼容 Web API 的 serverless host。
- Storage adapter：GitHub Contents API。
- Tool protocols：ChatGPT Actions OpenAPI 和 MCP JSON-RPC。
- File scope：配置的 vault root 内的相对 Markdown 路径。
- Write model：propose、review diff、commit with token and CAS。

它不是同步引擎、数据库、Agent 框架，也不是高风险自动化的直接写入 API。

## 快速开始

```bash
npm install
npm test
cp wrangler.toml.example wrangler.toml
```

这些 secret 必须配置在 serverless provider 中，不能写进仓库：

```text
VAULT_BRIDGE_API_KEY
PROPOSAL_TOKEN_SECRET
GITHUB_TOKEN
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
VAULT_ROOT_PREFIX
```

部署：

```bash
wrangler deploy
```

在 ChatGPT Actions 中导入 schema：

```text
https://<worker-host>/openapi.json
```

鉴权使用 `X-API-Key: <key>`。

## 工具流程

1. `auth_probe`：确认客户端是否发送了匹配的 API key，但不返回 key。
2. `read_note`：读取 Markdown 文件和当前 SHA。
3. `propose_note_patch`：提交新的 Markdown 内容，并获得 diff 和 confirmation token。
4. 审阅 diff。
5. `commit_note_patch`：用同一个 path、base SHA 和 token 提交同一份 proposed content。

MCP 客户端通过 `POST /mcp` 使用同一套服务行为。

## 失败语义

- 绝对路径、路径逃逸、反斜杠和非 Markdown 目标都 fail closed。
- `propose_note_patch` 永远不修改存储。
- token mismatch、digest mismatch、path mismatch 和 base SHA mismatch 都 fail closed。
- GitHub CAS 冲突返回 conflict error，不覆盖较新的内容。
- `auth_probe` 只报告 header delivery state，不返回 secret 或 vault content。

## 仓库内容

- `src/`：serverless runtime、routing、MCP adapter、GitHub store、path policy、proposal tokens。
- `test/`：覆盖鉴权、路径安全、token binding、CAS conflict、OpenAPI schema 和 MCP parity 的行为测试。
- `wrangler.toml.example`：不含 secret 的部署模板。
