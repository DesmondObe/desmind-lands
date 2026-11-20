"use client";

import { useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ApiError, api, type Me } from "@/lib/api";

type Session = { me: Me | null; loading: boolean; refresh: () => Promise<void>; signOut: () => Promise<void> };

const SessionContext = createContext<Session | null>(null);

/** Tabs of the same browser tell each other when someone signs in or out. */
const CHANNEL = "desmind-lands-session";
/** Coming back to a tab after this long checks the session is still good. */
const RECHECK_MS = 60_000;

/**
 * Who is signed in. Checked on load, again whenever the tab comes back into view after a
 * minute, and every ten minutes; a sign-in or sign-out in one tab reaches every other tab.
 * A network blip never signs anyone out: only the API saying "signed out" (401) does.
 */
export function SessionProvider({ children, hinted = false }: { children: ReactNode; hinted?: boolean }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const checked = useRef(0);
  const staleCookie = useRef(hinted);
  const channel = useRef<BroadcastChannel | null>(null);
  const userId = useRef<string | null>(null);

  const announce = useCallback((id: string | null) => {
    if (userId.current === id) return;
    const first = checked.current === 0;
    userId.current = id;
    if (!first) channel.current?.postMessage({ userId: id });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await api<Me>("/me");
      setMe(next);
      staleCookie.current = true;
      announce(next.user.id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setMe(null);
        announce(null);
        // The browser still held a session cookie the API no longer accepts: clear it, so the
        // site stops opening the portal for a session that has ended.
        if (staleCookie.current) {
          staleCookie.current = false;
          api("/auth/logout", "POST", {}).catch(() => {});
        }
      } else {
        // Offline or the server busy: keep whoever was signed in; the next check will tell.
        console.error(err);
      }
    } finally {
      checked.current = Date.now();
      setLoading(false);
    }
  }, [announce]);

  const signOut = useCallback(async () => {
    try {
      await api("/auth/logout", "POST", {});
    } finally {
      staleCookie.current = false;
      setMe(null);
      userId.current = null;
      channel.current?.postMessage({ userId: null });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Other tabs: someone signed in or out there, so look again here.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(CHANNEL);
    channel.current = ch;
    ch.onmessage = (e: MessageEvent<{ userId: string | null }>) => {
      if (e.data?.userId === null) {
        setMe(null);
        userId.current = null;
        staleCookie.current = false;
      } else void refresh();
    };
    return () => {
      ch.close();
      channel.current = null;
    };
  }, [refresh]);

  // Back to the tab after a while, and a slow check in the background.
  useEffect(() => {
    const again = () => {
      if (document.visibilityState === "visible" && Date.now() - checked.current > RECHECK_MS) void refresh();
    };
    const timer = window.setInterval(again, 10 * 60_000);
    document.addEventListener("visibilitychange", again);
    window.addEventListener("focus", again);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", again);
      window.removeEventListener("focus", again);
    };
  }, [refresh]);

  return <SessionContext value={{ me, loading, refresh, signOut }}>{children}</SessionContext>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession outside SessionProvider");
  return ctx;
}

/** Sends a signed-out visitor to sign in, then back here. */
export function useRequireSignIn() {
  const session = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!session.loading && !session.me) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [session.loading, session.me, router]);
  return session;
}
