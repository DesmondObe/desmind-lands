import { createHash, randomBytes } from "node:crypto";

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Opaque session, reset and witness tokens: 256 bits, URL-safe. */
export const newSecret = () => randomBytes(32).toString("base64url");
