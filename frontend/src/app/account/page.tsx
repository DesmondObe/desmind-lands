"use client";

import { useEffect, useState } from "react";
import { useRequireSignIn } from "@/components/session";
import { Loading, Page } from "@/components/shell";
import { toast } from "@/components/toast";
import { Button, Card, ErrorText, Field, Input, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDay } from "@/lib/land";

export default function AccountPage() {
  const { me, refresh } = useRequireSignIn();
  const [profile, setProfile] = useState({ fullName: "", phone: "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (me) setProfile({ fullName: me.user.fullName, phone: me.user.phone ? `+${me.user.phone}` : "" });
  }, [me]);
  if (!me) return <Loading />;

  return (
    <Page>
      <PageTitle
        eyebrow="Account"
        title={me.user.fullName}
        subtitle={`${me.user.email} · member since ${formatDay(me.user.createdAt)}`}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-2xl text-ink">Profile</h2>
          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy("profile");
              setError(null);
              try {
                await api("/me", "PATCH", profile);
                await refresh();
                toast("Profile saved");
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(null);
              }
            }}
          >
            <Field
              label="Full name"
              hint="The name you sign agreements with. It cannot change after you have signed one."
            >
              <Input value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </Field>
            <ErrorText error={error} />
            <Button type="submit" busy={busy === "profile"}>
              Save
            </Button>
          </form>
        </Card>
        <Card>
          <h2 className="font-display text-2xl text-ink">Password</h2>
          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy("pw");
              setPwError(null);
              try {
                await api("/me/password", "POST", pw);
                setPw({ currentPassword: "", newPassword: "" });
                toast("Password changed. Other devices were signed out.");
              } catch (err) {
                setPwError((err as Error).message);
              } finally {
                setBusy(null);
              }
            }}
          >
            <Field label="Current password">
              <Input
                type="password"
                autoComplete="current-password"
                value={pw.currentPassword}
                onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
              />
            </Field>
            <Field label="New password" hint="At least 10 characters.">
              <Input
                type="password"
                autoComplete="new-password"
                value={pw.newPassword}
                onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
              />
            </Field>
            <ErrorText error={pwError} />
            <Button type="submit" busy={busy === "pw"}>
              Change password
            </Button>
          </form>
        </Card>
      </div>
    </Page>
  );
}
