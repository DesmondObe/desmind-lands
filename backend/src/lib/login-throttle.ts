import { sha256 } from "./tokens.ts";

/**
 * Failed sign-ins, counted per account rather than per address. The per-address rate limit
 * stops one machine hammering the endpoint; this stops many machines (or a spoofed
 * X-Forwarded-For) guessing one account's password. After MAX_FAILURES wrong passwords the
 * account refuses password attempts until the window has passed, without even checking
 * the password, so a correct guess inside the lock is worth nothing.
 *
 * Counters are in this process. One API instance is the deployment today; with several,
 * each instance counts separately, which still bounds guesses to MAX_FAILURES per instance.
 */
export const MAX_FAILURES = 8;
export const WINDOW_MS = 15 * 60_000;
const MAX_TRACKED = 50_000;

type Entry = { failures: number; resetAt: number };

export class LoginThrottle {
  private readonly entries = new Map<string, Entry>();
  private readonly now: () => number;
  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  private key(email: string) {
    return sha256(email.trim().toLowerCase());
  }

  private live(key: string) {
    const e = this.entries.get(key);
    if (e && e.resetAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return e;
  }

  /** Seconds until the account takes password attempts again, or 0 if it does now. */
  lockedFor(email: string): number {
    const e = this.live(this.key(email));
    return e && e.failures >= MAX_FAILURES ? Math.ceil((e.resetAt - this.now()) / 1000) : 0;
  }

  fail(email: string) {
    const key = this.key(email);
    const e = this.live(key);
    if (e) e.failures += 1;
    else {
      if (this.entries.size >= MAX_TRACKED) this.prune();
      this.entries.set(key, { failures: 1, resetAt: this.now() + WINDOW_MS });
    }
  }

  succeed(email: string) {
    this.entries.delete(this.key(email));
  }

  private prune() {
    const now = this.now();
    for (const [k, e] of this.entries) if (e.resetAt <= now) this.entries.delete(k);
    // Still full of live entries: drop the oldest, which a Map keeps first.
    while (this.entries.size >= MAX_TRACKED) this.entries.delete(this.entries.keys().next().value!);
  }
}
