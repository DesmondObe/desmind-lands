import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { HttpError } from "./errors.ts";

export function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    throw new HttpError(400, `${where}${issue?.message ?? "Invalid request."}`);
  }
  return result.data;
}

export function requireUser(req: FastifyRequest): string {
  if (!req.userId) throw new HttpError(401, "Sign in first.");
  return req.userId;
}

/**
 * A yes/no in a query string. z.coerce.boolean() will not do: it reads any non-empty text,
 * "false" included, as true.
 */
export const queryFlag = z
  .enum(["true", "false", "1", "0", ""])
  .default("false")
  .transform((v) => v === "true" || v === "1");

export const id = z.uuid();
export const idParams = z.object({ id });
export const orgParams = z.object({ orgId: id });

/**
 * Keyset pagination cursor. Ids are UUIDv7, which sort by creation time, so the last id
 * seen is the whole cursor: stable at any depth, unlike OFFSET.
 */
export const cursor = z.uuid().optional();
