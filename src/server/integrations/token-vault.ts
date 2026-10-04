import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { APIError } from "@/server/errors";
function key() {
  const value = process.env.GMAIL_TOKEN_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(value))
    throw new APIError(
      503,
      "Configure GMAIL_TOKEN_KEY as 32 random bytes encoded in hex.",
    );
  return Buffer.from(value, "hex");
}
export function encryptToken(token: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data]
    .map((b) => b.toString("base64url"))
    .join(".");
}
export function decryptToken(value: string) {
  const [iv, tag, data] = value
    .split(".")
    .map((s) => Buffer.from(s, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", key(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8");
}
