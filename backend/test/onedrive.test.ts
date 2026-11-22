import { afterEach, expect, test, vi } from "vitest";
import { oneDriveStorage, type SecretStore } from "../src/lib/storage.ts";

afterEach(() => vi.unstubAllGlobals());

/** Microsoft's sign-in and Graph, in memory: enough of both for the storage driver. */
function fakeMicrosoft() {
  const files = new Map<string, { bytes: Buffer; type: string }>();
  const signIns: string[] = [];
  let n = 0;
  vi.stubGlobal("fetch", async (input: string | URL, init: RequestInit = {}) => {
    const url = String(input);
    if (url.startsWith("https://login.microsoftonline.com/")) {
      signIns.push(new URLSearchParams(init.body as URLSearchParams).get("refresh_token")!);
      n++;
      return Response.json({ access_token: `access-${n}`, refresh_token: `refresh-${n}`, expires_in: 3600 });
    }
    const auth = (init.headers as Record<string, string>).authorization;
    if (!auth?.startsWith("Bearer access-")) return new Response("", { status: 401 });
    const path = decodeURIComponent(
      new URL(url).pathname.replace("/v1.0/me/drive/root:/", "").replace(/:\/content$/, ""),
    );
    const method = init.method ?? "GET";
    if (method === "PUT") {
      files.set(path, {
        bytes: Buffer.from(init.body as Uint8Array),
        type: (init.headers as Record<string, string>)["content-type"]!,
      });
      return Response.json({}, { status: 201 });
    }
    const file = files.get(path);
    if (method === "DELETE") {
      files.delete(path);
      return new Response(null, { status: file ? 204 : 404 });
    }
    if (!file) return new Response("", { status: 404 });
    if (url.endsWith(":/content")) return new Response(new Uint8Array(file.bytes));
    return Response.json({ size: file.bytes.length, file: { mimeType: file.type } });
  });
  return { files, signIns };
}

function memorySecrets() {
  const rows = new Map<string, { value: string; sourceHash: string }>();
  const store: SecretStore = {
    get: async (name) => rows.get(name) ?? null,
    set: async (name, value, sourceHash) => void rows.set(name, { value, sourceHash }),
  };
  return { rows, store };
}

const options = (secrets: SecretStore, refreshToken = "configured-token") => ({
  clientId: "client",
  refreshToken,
  tokenKey: "a key",
  folder: "/DesMindLands/",
  publicBase: "/api",
  secrets,
});

test("keeps a file in the OneDrive folder and gives it back", async () => {
  const ms = fakeMicrosoft();
  const storage = oneDriveStorage(options(memorySecrets().store));
  const key = "listings/abc/photo one.jpg";

  expect(await storage.head(key)).toBeNull();
  await storage.put(key, Buffer.from("a photograph"), "image/jpeg");
  expect([...ms.files.keys()]).toEqual(["DesMindLands/listings/abc/photo one.jpg"]);
  expect(await storage.head(key)).toEqual({ sizeBytes: 12, contentType: "image/jpeg" });
  expect((await storage.read(key))?.toString()).toBe("a photograph");

  await storage.delete(key);
  expect(await storage.read(key)).toBeNull();
  // One sign-in served every call.
  expect(ms.signIns).toEqual(["configured-token"]);
});

test("issues upload and download links through the site's own /api", async () => {
  fakeMicrosoft();
  const storage = oneDriveStorage(options(memorySecrets().store));
  const { url } = await storage.uploadUrl("deals/x/receipt.pdf", "application/pdf", 10);
  expect(url.startsWith("/api/storage?grant=")).toBe(true);
  expect(storage.readGrant(url.split("grant=")[1]!)).toMatchObject({ k: "deals/x/receipt.pdf", op: "put", n: 10 });
});

test("signs in with the newest refresh token after a restart, until a new one is configured", async () => {
  const ms = fakeMicrosoft();
  const secrets = memorySecrets();

  await oneDriveStorage(options(secrets.store)).head("a");
  // Kept encrypted, not as issued.
  expect(secrets.rows.get("onedrive_refresh")!.value).not.toContain("refresh-1");

  await oneDriveStorage(options(secrets.store)).head("a");
  await oneDriveStorage(options(secrets.store, "a-new-configured-token")).head("a");
  expect(ms.signIns).toEqual(["configured-token", "refresh-1", "a-new-configured-token"]);
});
