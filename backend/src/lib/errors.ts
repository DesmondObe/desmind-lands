export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const notFound = (what = "Not found.") => new HttpError(404, what);
export const forbidden = (why = "You do not have access to this.") => new HttpError(403, why);

/**
 * Database functions raise SQLSTATE 'LPnnn' for errors meant for the user; nnn is the
 * HTTP status. Everything else from Postgres is a server fault.
 */
export function fromDatabaseError(err: unknown): HttpError | null {
  const e = err as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const source = e?.code ? e : e?.cause;
  const code = source?.code;
  if (code && /^LP\d{3}$/.test(code)) return new HttpError(Number(code.slice(2)), source?.message ?? "");
  if (code === "42501") return forbidden();
  // A row still referred to elsewhere, e.g. a room with tenancy history.
  if (code === "23503" || code === "23001")
    return new HttpError(409, "This is still referred to by other records, so it cannot be removed.");
  // Two requests raced to make the same thing (say, a double tap opening one deal twice):
  // the second lost to a unique index. That is a conflict, not a server fault.
  if (code === "23505") return new HttpError(409, "This was already done a moment ago. Refresh the page to see it.");
  return null;
}
