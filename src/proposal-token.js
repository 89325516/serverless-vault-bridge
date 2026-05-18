import { bytesFromHex, hexFromBytes, sha256Hex, utf8Bytes } from "./bytes.js";
import { httpError } from "./http.js";

export class ProposalTokenSigner {
  constructor({ secret, ttlSeconds, clock }) {
    this.secret = secret;
    this.ttlSeconds = ttlSeconds;
    this.clock = clock;
  }

  async signProposal(payload) {
    const expiresAt = this.clock.now() + this.ttlSeconds;
    const body = { ...payload, expires_at: expiresAt };
    const encoded = base64UrlEncode(JSON.stringify(body));
    const signature = await this.hmac(encoded);
    return {
      token: `${encoded}.${signature}`,
      expiresAt,
    };
  }

  async verifyProposal(token, expected) {
    const [encoded, signature] = String(token || "").split(".");
    if (!encoded || !signature) {
      throw httpError(403, "invalid_proposal_token");
    }
    const actual = await this.hmac(encoded);
    if (!timingSafeEqual(signature, actual)) {
      throw httpError(403, "invalid_proposal_token");
    }
    const payload = JSON.parse(base64UrlDecode(encoded));
    if (Number(payload.expires_at || 0) < this.clock.now()) {
      throw httpError(403, "proposal_token_expired");
    }
    for (const [key, value] of Object.entries(expected)) {
      const actualValue = payload[key] ?? null;
      const expectedValue = value ?? null;
      if (actualValue !== expectedValue) {
        throw httpError(403, "proposal_token_mismatch", key);
      }
    }
    return payload;
  }

  async hmac(value) {
    const key = await crypto.subtle.importKey(
      "raw",
      utf8Bytes(this.secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, utf8Bytes(value));
    return base64UrlFromBytes(new Uint8Array(signature));
  }
}

export async function proposalDigest({ path, baseSha, newContent }) {
  return {
    action: "commit_note_patch",
    path,
    base_sha: baseSha ?? null,
    new_sha: await sha256Hex(newContent),
  };
}

function base64UrlEncode(value) {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = String(value).replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(padded);
}

function base64UrlFromBytes(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function timingSafeEqual(left, right) {
  const leftHex = hexFromBytes(utf8Bytes(left));
  const rightHex = hexFromBytes(utf8Bytes(right));
  if (leftHex.length !== rightHex.length) {
    return false;
  }
  const leftBytes = bytesFromHex(leftHex);
  const rightBytes = bytesFromHex(rightHex);
  let diff = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index];
  }
  return diff === 0;
}
