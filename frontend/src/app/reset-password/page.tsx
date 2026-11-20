"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthShell } from "@/components/shell";
import { Button, ErrorText, Field, Input } from "@/components/ui";
import { api } from "@/lib/api";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return setValid(false);
    api<{ valid: boolean }>(`/auth/reset-password/${encodeURIComponent(token)}`).then(
      (r) => setValid(r.valid),
      // The check itself failed (no connection, say): that is not an expired link. Show the
      // form; sending it gives the true answer.
      () => setValid(true),
    );
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/reset-password", "POST", { token, password });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Choose a new password">
      {done ? (
        <p className="text-ink-soft">
          Your password is changed, and every device was signed out.{" "}
          <Link href="/login" className="font-semibold text-earth-600">
            Sign in
          </Link>
        </p>
      ) : valid === false ? (
        <p className="text-ink-soft">
          This link has expired or was already used.{" "}
          <Link href="/forgot-password" className="font-semibold text-earth-600">
            Ask for a new one
          </Link>
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <Field label="New password" hint="At least 10 characters.">
            <Input
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <ErrorText error={error} />
          <Button type="submit" busy={busy} disabled={valid === null} size="lg" className="w-full">
            Save password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
