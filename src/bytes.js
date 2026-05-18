const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function utf8Bytes(value) {
  return encoder.encode(String(value ?? ""));
}

export function utf8FromBase64(value) {
  const binary = atob(String(value ?? "").replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return decoder.decode(bytes);
}

export function base64FromUtf8(value) {
  const bytes = utf8Bytes(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", utf8Bytes(value));
  return hexFromBytes(new Uint8Array(digest));
}

export function hexFromBytes(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function bytesFromHex(value) {
  const text = String(value ?? "");
  if (text.length % 2 !== 0 || /[^0-9a-f]/i.test(text)) {
    throw new Error("invalid_hex");
  }
  const bytes = new Uint8Array(text.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(text.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}
