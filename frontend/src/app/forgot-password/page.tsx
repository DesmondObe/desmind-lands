"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/shell";
import { Button, ErrorText, Field, Input } from "@/components/ui";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/forgot-password", "POST", { email });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Reset your password" subtitle="We will email you a link that works for one hour.">
      {sent ? (
        <div className="rounded-3xl border border-line bg-surface p-6 text-ink-soft">
          If <strong className="text-ink">{email}</strong> has an account, a reset link is on its way. Check your inbox
          (and spam folder).
          <p className="mt-4">
            <Link href="/login" className="font-semibold text-earth-600">
              Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <ErrorText error={error} />
          <Button type="submit" busy={busy} size="lg" className="w-full">
            Send the link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
