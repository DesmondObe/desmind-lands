"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useSession } from "@/components/session";
import { AuthShell } from "@/components/shell";
import { Button, ErrorText, Field, Input } from "@/components/ui";
import { api, safeNext } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { refresh } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/login", "POST", { email, password });
      await refresh();
      router.replace(next ?? "/dashboard");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle={
        <>
          New here?{" "}
          <Link
            href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-semibold text-earth-600"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label="Email">
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <ErrorText error={error} />
        <Button type="submit" busy={busy} size="lg" className="w-full">
          Sign in
        </Button>
        <p className="text-center text-sm">
          <Link href="/forgot-password" className="text-ink-soft underline underline-offset-4 hover:text-ink">
            Forgotten your password?
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
