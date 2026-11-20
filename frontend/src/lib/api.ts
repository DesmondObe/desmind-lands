export class ApiError extends Error {
  readonly status: number;
  readonly ref: string | null;
  constructor(status: number, message: string, ref: string | null = null) {
    super(message);
    this.status = status;
    this.ref = ref;
  }
}

const TIMEOUT_MS = 45_000;

function explain(status: number): string {
  if (status === 0)
    return typeof navigator !== "undefined" && !navigator.onLine
      ? "You are offline. Check your internet connection and try again."
      : "Could not reach DesMind Lands. Check your connection and try again.";
  if (status === 401) return "You are signed out. Sign in again.";
  if (status === 403) return "You do not have access to this.";
  if (status === 404) return "Not found.";
  if (status === 408 || status === 504) return "The server took too long to answer. Try again in a moment.";
  if (status === 429) return "Too many attempts in a short time. Wait a minute, then try again.";
  if (status === 502 || status === 503) return "The server is not responding right now. Try again in a minute.";
  return `Something went wrong (error ${status}). Try again.`;
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

/** Calls the API through the web origin (next.config.ts proxies /api), carrying the session cookie. */
export async function api<T = unknown>(path: string, method: Method = "GET", body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const status = (err as Error).name === "TimeoutError" ? 408 : 0;
    throw new ApiError(status, explain(status));
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const ref: string | null = data?.ref ?? res.headers.get("x-request-id");
    let message: string = data?.error || explain(res.status);
    if (res.status >= 500 && ref) message = `${message.replace(/\.?$/, ".")} Reference: ${ref}.`;
    throw new ApiError(res.status, message, ref);
  }
  return data as T;
}

/** Only same-site paths, so a crafted ?next= cannot bounce someone to another site. */
export function safeNext(next: string | null) {
  return next?.startsWith("/") && !/^\/[/\\]/.test(next) ? next : null;
}

const TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

export function fileType(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TYPE_BY_EXTENSION[ext] ?? (file.type || "application/octet-stream");
}

export type FileKind = "photo" | "title_document" | "survey_plan" | "payment_proof" | "identity" | "other";

/** The API issues a signed URL, the browser sends the file straight to storage, the API checks it. */
export async function uploadFile(file: File, target: { listingId?: string; dealId?: string; kind: FileKind }) {
  const created = await api<{ file: { id: string }; upload: { url: string; headers: Record<string, string> } }>(
    "/files/uploads",
    "POST",
    { ...target, filename: file.name, contentType: fileType(file), sizeBytes: file.size },
  );
  let put: Response;
  try {
    put = await fetch(created.upload.url, { method: "PUT", headers: created.upload.headers, body: file });
  } catch {
    throw new ApiError(0, "The file could not be sent. Check your connection and try again.");
  }
  if (!put.ok) throw new ApiError(put.status, `Storage refused the upload (error ${put.status}). Try a smaller file.`);
  await api(`/files/${created.file.id}/complete`, "POST", {});
  return created.file.id;
}

/** Opens a file in a new tab through a short-lived link. */
export async function openFile(id: string) {
  const tab = window.open("", "_blank");
  try {
    const { url } = await api<{ url: string }>(`/files/${id}/url`);
    if (tab) tab.location.href = url;
    else window.location.assign(url);
  } catch (err) {
    tab?.close();
    throw err;
  }
}

export type Me = {
  user: { id: string; email: string; fullName: string; phone: string; platformRole: "admin" | null; createdAt: string };
  openDeals: number;
};

export type ListingCard = {
  id: string;
  title: string;
  state: string;
  lga: string;
  town: string;
  sizeValue: number;
  sizeUnit: string;
  priceKobo: number;
  negotiable: boolean;
  landUse: string;
  titleKind: string;
  features: string[];
  status: string;
  publishedAt: string | null;
  createdAt: string;
  coverUrl: string | null;
  photoCount: number;
  reviewNote?: string;
  openDeals?: number;
};

export type Listing = Omit<ListingCard, "coverUrl" | "photoCount"> & {
  sellerId: string;
  description: string;
  addressLine: string;
  titleReference: string;
  latitude: number | null;
  longitude: number | null;
  reviewNote: string;
  soldAt: string | null;
  updatedAt: string;
};

export type DealStage = "negotiating" | "checks" | "agreement" | "payment" | "completed" | "cancelled";
export type Side = "seller" | "buyer";

export type DealRow = {
  id: string;
  stage: DealStage;
  role: Side;
  counterpart: string;
  listing: { id: string; title: string; town: string; state: string; priceKobo: number };
  agreedKobo: number | null;
  openOfferKobo: number | null;
  confirmedKobo: number;
  nextStep: string;
  yourMove: boolean;
  updatedAt: string;
  createdAt: string;
};
