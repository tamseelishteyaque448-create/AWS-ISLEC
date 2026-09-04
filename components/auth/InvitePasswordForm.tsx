"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const minimumPasswordLength = 8;
const maximumPasswordLength = 1024;

type InviteState = "checking" | "ready" | "error";

export function InvitePasswordForm() {
  const router = useRouter();
  const supabaseConfigured = isSupabaseConfigured();
  const [inviteState, setInviteState] = useState<InviteState>(supabaseConfigured ? "checking" : "error");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(supabaseConfigured ? null : "Account setup is temporarily unavailable. Please contact an administrator.");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;

    let cancelled = false;

    async function establishInviteSession() {
      // The default Supabase invitation flow identifies the invite in the URL
      // fragment. Capture that marker before creating the browser client, which
      // consumes the fragment while establishing the session.
      const fragmentType = new URLSearchParams(window.location.hash.slice(1)).get("type");
      const supabase = createClient();
      const { data, error: sessionError } = await supabase.auth.getSession();

      // Supabase has now consumed and persisted any implicit-flow fragment.
      // Do not leave its one-time session values in the visible URL or history.
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);

      if (cancelled) return;

      if (fragmentType !== "invite" || sessionError || !data.session) {
        window.location.replace("/join?mode=login&next=/member");
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userError || !userData.user || !userData.user.invited_at) {
        window.location.replace("/join?mode=login&next=/member");
        return;
      }

      setInviteState("ready");
    }

    void establishInviteSession();

    return () => {
      cancelled = true;
    };
  }, [router, supabaseConfigured]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < minimumPasswordLength) {
      setError(`Use at least ${minimumPasswordLength} characters for your password.`);
      return;
    }

    if (password.length > maximumPasswordLength) {
      setError(`Use no more than ${maximumPasswordLength} characters for your password.`);
      return;
    }

    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setError(null);
    setIsSaving(true);

    const supabase = createClient();
    const { data, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !data.session) {
      window.location.replace("/join?mode=login&next=/member");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setIsSaving(false);
      return;
    }

    setPassword("");
    setConfirmation("");
    router.replace("/member");
  }

  return <main className="auth-invite-page">
    <section className="auth-card auth-invite-card" aria-labelledby="invite-title">
      <div className="eyebrow">AWS ISLEC invitation</div>
      <h1 id="invite-title">Create your password.</h1>
      <p>Choose a password to finish setting up your member account.</p>

      {inviteState === "checking" ? <p className="auth-message" role="status">Confirming your invitation…</p> : null}
      {inviteState === "error" ? <p className="auth-message error" role="alert">{error}</p> : null}

      {inviteState === "ready" ? <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="invite-password">Password</label>
        <input id="invite-password" name="password" type="password" autoComplete="new-password" minLength={minimumPasswordLength} maxLength={maximumPasswordLength} value={password} onChange={(event) => setPassword(event.target.value)} required disabled={isSaving} />
        <label htmlFor="invite-password-confirmation">Confirm password</label>
        <input id="invite-password-confirmation" name="password-confirmation" type="password" autoComplete="new-password" minLength={minimumPasswordLength} maxLength={maximumPasswordLength} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required disabled={isSaving} />
        {error ? <p className="auth-message error" role="alert">{error}</p> : null}
        <button className="button auth-submit" type="submit" disabled={isSaving}>{isSaving ? "Saving password…" : "Finish setup"}</button>
      </form> : null}
    </section>
  </main>;
}
