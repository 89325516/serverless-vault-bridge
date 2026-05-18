export async function readJson(request) {
  if (!request.body) {
    return {};
  }
  try {
    return await request.json();
  } catch {
    throw httpError(400, "invalid_json");
  }
}

export function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "access-control-allow-headers": "authorization,content-type,mcp-protocol-version,x-api-key",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-origin": "*",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export function authState(request, apiKey) {
  if (!apiKey) {
    throw httpError(500, "bridge_misconfigured", "missing_api_key");
  }
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const headerApiKey = request.headers.get("x-api-key")?.trim() ?? "";
  const authorizationShape = authorization.startsWith("Bearer ") ? "bearer" : authorization ? "raw" : "missing";
  return {
    authenticated: authorization === `Bearer ${apiKey}` || authorization === apiKey || headerApiKey === apiKey,
    received_authorization: Boolean(authorization),
    received_x_api_key: Boolean(headerApiKey),
    authorization_shape: authorizationShape,
    expected_header: "X-API-Key",
  };
}

export function assertAuthorized(request, apiKey) {
  if (!authState(request, apiKey).authenticated) {
    throw httpError(401, "unauthorized");
  }
}

export function httpError(status, code, detail = "") {
  const error = new Error(code);
  error.status = status;
  error.code = code;
  error.detail = detail;
  return error;
}

export function errorResponse(error) {
  const status = Number(error?.status || 500);
  return jsonResponse(
    {
      error: {
        code: error?.code || error?.message || "internal_error",
        detail: error?.detail || "",
      },
    },
    status,
  );
}
