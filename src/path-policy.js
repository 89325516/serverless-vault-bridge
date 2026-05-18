import { httpError } from "./http.js";

export class VaultPathPolicy {
  validateNotePath(path) {
    const text = String(path ?? "").trim();
    if (!text) {
      throw httpError(400, "path_required");
    }
    if (text.startsWith("/") || text.includes("\\") || text.includes("\0")) {
      throw httpError(400, "path_outside_vault");
    }
    const parts = text.split("/");
    if (parts.some((part) => !part || part === "." || part === "..")) {
      throw httpError(400, "path_outside_vault");
    }
    if (!text.endsWith(".md")) {
      throw httpError(400, "markdown_required");
    }
    return parts.join("/");
  }

  validatePrefix(pathPrefix) {
    if (!pathPrefix) {
      return "";
    }
    const text = String(pathPrefix).trim();
    if (text.startsWith("/") || text.includes("\\") || text.includes("\0")) {
      throw httpError(400, "path_outside_vault");
    }
    const parts = text.split("/").filter(Boolean);
    if (parts.some((part) => part === "." || part === "..")) {
      throw httpError(400, "path_outside_vault");
    }
    return parts.join("/");
  }
}
