export function openApiDocument(origin) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Serverless Vault Bridge",
      version: "0.1.0",
      description: "Read and write a scoped Markdown vault through a serverless bridge.",
    },
    servers: [{ url: origin }],
    components: {
      securitySchemes: {
        apiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" },
        bearerAuth: { type: "http", scheme: "bearer" },
      },
      schemas: responseSchemas(),
    },
    security: [{ apiKeyAuth: [] }],
    paths: {
      "/actions/auth_probe": {
        post: {
          operationId: "auth_probe",
          summary: "Check whether ChatGPT Actions is sending the configured API key header",
          "x-openai-isConsequential": false,
          requestBody: jsonBody({
            type: "object",
            properties: {},
            additionalProperties: false,
          }),
          responses: okResponse(authProbeResponseSchema()),
        },
      },
      "/actions/search_notes": {
        post: {
          operationId: "search_notes",
          summary: "Search Markdown notes",
          "x-openai-isConsequential": false,
          requestBody: jsonBody({
            type: "object",
            properties: {
              query: { type: "string" },
              max_results: { type: "integer", minimum: 1, maximum: 20 },
              path_prefix: { type: "string" },
            },
            required: ["query"],
          }),
          responses: okResponse(searchNotesResponseSchema()),
        },
      },
      "/actions/read_note": {
        post: {
          operationId: "read_note",
          summary: "Read one Markdown note",
          "x-openai-isConsequential": false,
          requestBody: jsonBody({
            type: "object",
            properties: { path: { type: "string" } },
            required: ["path"],
          }),
          responses: okResponse(readNoteResponseSchema()),
        },
      },
      "/actions/propose_note_patch": {
        post: {
          operationId: "propose_note_patch",
          summary: "Propose a note write and return a diff",
          "x-openai-isConsequential": false,
          requestBody: jsonBody({
            type: "object",
            properties: {
              path: { type: "string" },
              new_content: { type: "string" },
            },
            required: ["path", "new_content"],
          }),
          responses: okResponse(proposeNotePatchResponseSchema()),
        },
      },
      "/actions/commit_note_patch": {
        post: {
          operationId: "commit_note_patch",
          summary: "Commit a previously proposed note write",
          "x-openai-isConsequential": true,
          requestBody: jsonBody({
            type: "object",
            properties: {
              path: { type: "string" },
              new_content: { type: "string" },
              base_sha: { type: ["string", "null"] },
              confirmation_token: { type: "string" },
            },
            required: ["path", "new_content", "confirmation_token"],
          }),
          responses: okResponse(commitNotePatchResponseSchema()),
        },
      },
    },
  };
}

function responseSchemas() {
  return {
    AuthProbeResponse: authProbeResponseSchema(),
    SearchNotesResponse: searchNotesResponseSchema(),
    SearchNoteResult: searchNoteResultSchema(),
    ReadNoteResponse: readNoteResponseSchema(),
    ProposeNotePatchResponse: proposeNotePatchResponseSchema(),
    CommitNotePatchResponse: commitNotePatchResponseSchema(),
  };
}

function authProbeResponseSchema() {
  return {
    type: "object",
    properties: {
      authenticated: { type: "boolean" },
      received_authorization: { type: "boolean" },
      received_x_api_key: { type: "boolean" },
      authorization_shape: { type: "string", enum: ["missing", "bearer", "raw"] },
      expected_header: { type: "string" },
    },
    required: [
      "authenticated",
      "received_authorization",
      "received_x_api_key",
      "authorization_shape",
      "expected_header",
    ],
    additionalProperties: false,
  };
}

function searchNotesResponseSchema() {
  return {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: searchNoteResultSchema(),
      },
    },
    required: ["results"],
    additionalProperties: false,
  };
}

function searchNoteResultSchema() {
  return {
    type: "object",
    properties: {
      path: { type: "string" },
      sha: { type: "string" },
      title: { type: "string" },
      excerpt: { type: "string" },
    },
    required: ["path", "sha", "title", "excerpt"],
    additionalProperties: false,
  };
}

function readNoteResponseSchema() {
  return {
    type: "object",
    properties: {
      path: { type: "string" },
      sha: { type: "string" },
      content: { type: "string" },
      url: { type: "string" },
    },
    required: ["path", "sha", "content", "url"],
    additionalProperties: false,
  };
}

function proposeNotePatchResponseSchema() {
  return {
    type: "object",
    properties: {
      path: { type: "string" },
      base_sha: { type: ["string", "null"] },
      new_sha: { type: "string" },
      expires_at: { type: "string" },
      confirmation_token: { type: "string" },
      diff: { type: "string" },
    },
    required: ["path", "base_sha", "new_sha", "expires_at", "confirmation_token", "diff"],
    additionalProperties: false,
  };
}

function commitNotePatchResponseSchema() {
  return {
    type: "object",
    properties: {
      status: { type: "string" },
      path: { type: "string" },
      file_sha: { type: "string" },
      commit_sha: { type: "string" },
      url: { type: "string" },
      new_sha: { type: "string" },
    },
    required: ["status", "path", "file_sha", "commit_sha", "url", "new_sha"],
    additionalProperties: false,
  };
}

function jsonBody(schema) {
  return {
    required: true,
    content: { "application/json": { schema } },
  };
}

function okResponse(schema) {
  return {
    "200": {
      description: "Successful response",
      content: { "application/json": { schema } },
    },
  };
}
