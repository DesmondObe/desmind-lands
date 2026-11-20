import { hash, verify } from "@node-rs/argon2";

// OWASP's recommended argon2id settings: 19 MiB, 2 iterations.
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export const hashPassword = (password: string) => hash(password, OPTIONS);

// Verified against when the email is unknown, so a miss takes as long as a wrong password.
let decoy: Promise<string> | undefined;

export async function verifyPassword(stored: string | undefined, password: string) {
  if (!stored) {
    decoy ??= hashPassword("decoy password that nobody has");
    await verify(await decoy, password).catch(() => false);
    return false;
  }
  return verify(stored, password).catch(() => false);
}
