"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useSession } from "@/components/session";
import { AuthShell } from "@/components/shell";
import { Button, ErrorText, Field, Input } from "@/components/ui";
import { api, safeNext } from "@/lib/api";

function SignupForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { refresh } = useSession();
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/register", "POST", form);
      await refresh();
      router.replace(next ?? "/dashboard");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle={
        <>
          One account to buy and to sell. Already have one?{" "}
          <Link
            href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-semibold text-earth-600"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label="Full name, as on your ID" hint="This is the name you will sign agreements with.">
          <Input
            autoComplete="name"
            required
            value={form.fullName}
            onChange={set("fullName")}
            placeholder="Chidi Emmanuel Eze"
          />
        </Field>
        <Field label="Email">
          <Input type="email" autoComplete="email" required value={form.email} onChange={set("email")} />
        </Field>
        <Field label="Phone" hint="Shared only with the other party once you are in a deal together.">
          <Input type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} placeholder="0803 123 4567" />
        </Field>
        <Field label="Password" hint="At least 10 characters.">
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={form.password}
            onChange={set("password")}
          />
        </Field>
        <ErrorText error={error} />
        <Button type="submit" busy={busy} size="lg" className="w-full">
          Create account
        </Button>
        <p className="text-center text-xs leading-relaxed text-ink-faint">
          By creating an account you agree to the{" "}
          <Link href="/terms" className="underline">
            terms of use
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline">
            privacy notice
          </Link>
          .
        </p>
      </form>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
