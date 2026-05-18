/**
 * VaultStorePort shape:
 * - searchNotes({ query, pathPrefix, maxResults }) -> Promise<Array<{ path, sha, title, excerpt }>>
 * - readNote(path) -> Promise<{ path, sha, content, url }>
 * - commitNote({ path, content, baseSha, message }) -> Promise<{ path, sha, commitSha, url }>
 *
 * The application service receives this shape by injection. Concrete storage
 * adapters stay in composition roots or dedicated adapter modules.
 */
export const VAULT_STORE_PORT = "VaultStorePort";
