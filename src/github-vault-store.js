import { base64FromUtf8, utf8FromBase64 } from "./bytes.js";

export class GitHubVaultStore {
  constructor(config) {
    this.config = config;
  }

  async searchNotes({ query, pathPrefix, maxResults }) {
    const tree = await this.request(`/repos/${this.owner()}/${this.repo()}/git/trees/${encodeURIComponent(this.branch())}?recursive=1`);
    const prefix = this.repoPath(pathPrefix || "");
    const normalizedQuery = String(query ?? "").trim().toLowerCase();
    const files = (tree.tree || [])
      .filter((item) => item.type === "blob")
      .map((item) => String(item.path || ""))
      .filter((path) => path.endsWith(".md") && path.startsWith(prefix));
    const pathMatches = normalizedQuery ? files.filter((path) => this.vaultPath(path).toLowerCase().includes(normalizedQuery)) : [];
    const contentScanLimit = Math.min(40, Math.max(maxResults, Number(this.config.maxSearchFiles || maxResults * 8)));
    const candidates = pathMatches.length > 0 ? pathMatches.slice(0, maxResults) : files.slice(0, contentScanLimit);
    const results = [];
    for (const repoPath of candidates) {
      if (results.length >= maxResults) {
        break;
      }
      const note = await this.readRepoPath(repoPath);
      const haystack = `${this.vaultPath(repoPath)}\n${note.content}`.toLowerCase();
      if (!normalizedQuery || haystack.includes(normalizedQuery)) {
        results.push({
          path: this.vaultPath(repoPath),
          sha: note.sha,
          title: titleFromMarkdown(note.content, this.vaultPath(repoPath)),
          excerpt: excerptFor(note.content, normalizedQuery),
        });
      }
    }
    return results;
  }

  async readNote(path) {
    return this.readRepoPath(this.repoPath(path));
  }

  async commitNote({ path, content, baseSha, message }) {
    const body = {
      branch: this.branch(),
      message,
      content: base64FromUtf8(content),
    };
    if (baseSha) {
      body.sha = baseSha;
    }
    const result = await this.request(`/repos/${this.owner()}/${this.repo()}/contents/${encodePath(this.repoPath(path))}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return {
      path,
      sha: result.content?.sha || "",
      commitSha: result.commit?.sha || "",
      url: result.content?.html_url || result.commit?.html_url || "",
    };
  }

  async readRepoPath(repoPath) {
    try {
      const result = await this.request(`/repos/${this.owner()}/${this.repo()}/contents/${encodePath(repoPath)}?ref=${encodeURIComponent(this.branch())}`);
      if (Array.isArray(result) || result.type !== "file") {
        throw new Error("not_a_file");
      }
      return {
        path: this.vaultPath(repoPath),
        sha: result.sha || "",
        content: utf8FromBase64(result.content || ""),
        url: result.html_url || "",
      };
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) {
        return { path: this.vaultPath(repoPath), sha: null, content: "", url: "" };
      }
      throw error;
    }
  }

  async request(path, init = {}) {
    const response = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${this.config.token}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "serverless-vault-bridge",
        ...(init.headers || {}),
      },
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new GitHubApiError(response.status, payload.message || response.statusText);
    }
    return payload;
  }

  repoPath(path) {
    const prefix = String(this.config.vaultRootPrefix || "").replace(/^\/+|\/+$/g, "");
    const suffix = String(path || "").replace(/^\/+/, "");
    return prefix ? [prefix, suffix].filter(Boolean).join("/") : suffix;
  }

  vaultPath(repoPath) {
    const prefix = String(this.config.vaultRootPrefix || "").replace(/^\/+|\/+$/g, "");
    const text = String(repoPath || "");
    if (prefix && text.startsWith(`${prefix}/`)) {
      return text.slice(prefix.length + 1);
    }
    return text;
  }

  owner() {
    return encodeURIComponent(this.config.owner);
  }

  repo() {
    return encodeURIComponent(this.config.repo);
  }

  branch() {
    return this.config.branch;
  }
}

export class GitHubApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
  }
}

function encodePath(path) {
  return String(path || "").split("/").map(encodeURIComponent).join("/");
}

function titleFromMarkdown(content, path) {
  const line = String(content || "").split(/\r?\n/).find((item) => item.startsWith("# "));
  return line ? line.replace(/^#\s+/, "").trim() : path.split("/").pop().replace(/\.md$/, "");
}

function excerptFor(content, query) {
  const text = String(content || "").replace(/\s+/g, " ").trim();
  if (!query) {
    return text.slice(0, 240);
  }
  const index = text.toLowerCase().indexOf(query);
  if (index < 0) {
    return text.slice(0, 240);
  }
  return text.slice(Math.max(0, index - 80), index + query.length + 160);
}
