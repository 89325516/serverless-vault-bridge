import { assertAuthorized, authState, errorResponse, jsonResponse, readJson } from "./http.js";
import { handleMcp } from "./mcp-router.js";
import { openApiDocument } from "./openapi.js";

export async function routeRequest(request, service, config) {
  if (request.method === "OPTIONS") {
    return jsonResponse({});
  }
  const url = new URL(request.url);
  try {
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({ ok: true, service: "serverless-vault-bridge" });
    }
    if (request.method === "GET" && url.pathname === "/openapi.json") {
      return jsonResponse(openApiDocument(url.origin));
    }
    if (request.method === "POST" && url.pathname === "/actions/auth_probe") {
      return jsonResponse(authState(request, config.apiKey));
    }
    assertAuthorized(request, config.apiKey);
    if (request.method === "POST" && url.pathname === "/mcp") {
      return handleMcp(request, service);
    }
    if (request.method === "POST" && url.pathname.startsWith("/actions/")) {
      return jsonResponse(await actionResult(url.pathname, await readJson(request), service));
    }
    return jsonResponse({ error: { code: "not_found" } }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}

async function actionResult(pathname, body, service) {
  if (pathname === "/actions/search_notes") {
    return service.searchNotes(body);
  }
  if (pathname === "/actions/read_note") {
    return service.readNote(body);
  }
  if (pathname === "/actions/propose_note_patch") {
    return service.proposeNotePatch(body);
  }
  if (pathname === "/actions/commit_note_patch") {
    return service.commitNotePatch(body);
  }
  return { error: { code: "not_found" } };
}
