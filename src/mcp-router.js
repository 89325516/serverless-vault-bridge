const TOOL_SCHEMAS = {
  search_notes: {
    type: "object",
    properties: {
      query: { type: "string" },
      max_results: { type: "integer", minimum: 1, maximum: 20 },
      path_prefix: { type: "string" },
    },
    required: ["query"],
  },
  read_note: {
    type: "object",
    properties: { path: { type: "string" } },
    required: ["path"],
  },
  propose_note_patch: {
    type: "object",
    properties: {
      path: { type: "string" },
      new_content: { type: "string" },
    },
    required: ["path", "new_content"],
  },
  commit_note_patch: {
    type: "object",
    properties: {
      path: { type: "string" },
      new_content: { type: "string" },
      base_sha: { type: ["string", "null"] },
      confirmation_token: { type: "string" },
    },
    required: ["path", "new_content", "confirmation_token"],
  },
};

export async function handleMcp(request, service) {
  const payload = await request.json();
  const id = payload.id ?? "serverless-vault-bridge";
  try {
    const result = await mcpResult(payload.method, payload.params || {}, service);
    return rpcResult(id, result);
  } catch (error) {
    return rpcError(id, error);
  }
}

async function mcpResult(method, params, service) {
  if (method === "initialize") {
    return {
      protocolVersion: "2025-11-25",
      serverInfo: { name: "serverless-vault-bridge", version: "0.1.0" },
      capabilities: { tools: {} },
    };
  }
  if (method === "tools/list") {
    return { tools: toolsList() };
  }
  if (method === "tools/call") {
    const name = String(params.name || "");
    const args = params.arguments || {};
    const result = await callTool(name, args, service);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
  throw new Error(`unsupported_method:${method}`);
}

function toolsList() {
  return Object.entries(TOOL_SCHEMAS).map(([name, inputSchema]) => ({
    name,
    description: descriptionFor(name),
    inputSchema,
  }));
}

async function callTool(name, args, service) {
  if (name === "search_notes") {
    return service.searchNotes(args);
  }
  if (name === "read_note") {
    return service.readNote(args);
  }
  if (name === "propose_note_patch") {
    return service.proposeNotePatch(args);
  }
  if (name === "commit_note_patch") {
    return service.commitNotePatch(args);
  }
  throw new Error(`unknown_tool:${name}`);
}

function descriptionFor(name) {
  return {
    search_notes: "Search markdown notes inside the configured vault scope.",
    read_note: "Read one markdown note from the configured vault scope.",
    propose_note_patch: "Generate a diff and confirmation token for an exact markdown note write.",
    commit_note_patch: "Commit an exact proposed markdown note write after user review.",
  }[name];
}

function rpcResult(id, result) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function rpcError(id, error) {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: error?.message || "mcp_error" },
    }),
    { status: 200, headers: { "content-type": "application/json; charset=utf-8" } },
  );
}
