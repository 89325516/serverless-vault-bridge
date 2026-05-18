import { sha256Hex, utf8Bytes } from "./bytes.js";
import { renderUnifiedDiff } from "./diff.js";
import { httpError } from "./http.js";
import { proposalDigest } from "./proposal-token.js";

export class VaultService {
  constructor({ store, pathPolicy, proposalSigner, limits, clock }) {
    this.store = store;
    this.pathPolicy = pathPolicy;
    this.proposalSigner = proposalSigner;
    this.limits = limits;
    this.clock = clock;
  }

  async searchNotes(input) {
    const query = String(input.query ?? "").trim();
    const pathPrefix = this.pathPolicy.validatePrefix(input.path_prefix);
    const maxResults = clamp(input.max_results, 1, 20, 8);
    return {
      results: await this.store.searchNotes({ query, pathPrefix, maxResults: Math.min(maxResults, this.limits.maxSearchFiles) }),
    };
  }

  async readNote(input) {
    const path = this.pathPolicy.validateNotePath(input.path);
    const note = await this.store.readNote(path);
    if (note.sha === null) {
      throw httpError(404, "note_not_found");
    }
    return note;
  }

  async proposeNotePatch(input) {
    const path = this.pathPolicy.validateNotePath(input.path);
    const newContent = normalizeContent(input.new_content);
    this.assertSize(newContent);
    const current = await this.store.readNote(path);
    const digest = await proposalDigest({ path, baseSha: current.sha, newContent });
    const signed = await this.proposalSigner.signProposal(digest);
    return {
      path,
      base_sha: current.sha,
      new_sha: digest.new_sha,
      expires_at: new Date(signed.expiresAt * 1000).toISOString(),
      confirmation_token: signed.token,
      diff: renderUnifiedDiff({ path, oldContent: current.content, newContent }),
    };
  }

  async commitNotePatch(input) {
    const path = this.pathPolicy.validateNotePath(input.path);
    const newContent = normalizeContent(input.new_content);
    this.assertSize(newContent);
    const baseSha = input.base_sha ?? null;
    const digest = await proposalDigest({ path, baseSha, newContent });
    await this.proposalSigner.verifyProposal(input.confirmation_token, digest);
    const current = await this.store.readNote(path);
    if ((current.sha ?? null) !== baseSha) {
      throw httpError(409, "conflict_detected", "base_sha_changed");
    }
    const result = await this.commitWithConflictMapping({
      path,
      content: newContent,
      baseSha,
      message: `Update ${path} via Serverless Vault Bridge`,
    });
    return {
      status: "committed",
      path: result.path,
      file_sha: result.sha,
      commit_sha: result.commitSha,
      url: result.url,
      new_sha: await sha256Hex(newContent),
    };
  }

  async commitWithConflictMapping(change) {
    try {
      return await this.store.commitNote(change);
    } catch (error) {
      if (error?.status === 409 || error?.code === "conflict_detected") {
        throw httpError(409, "conflict_detected", "github_cas_rejected");
      }
      throw error;
    }
  }

  assertSize(content) {
    if (utf8Bytes(content).length > this.limits.maxNoteBytes) {
      throw httpError(413, "note_too_large");
    }
  }
}

export class SystemClock {
  now() {
    return Math.floor(Date.now() / 1000);
  }
}

function normalizeContent(value) {
  const text = String(value ?? "").replace(/\r\n/g, "\n");
  return text.endsWith("\n") ? text : `${text}\n`;
}

function clamp(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}
