"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, LogIn, UserPlus } from "lucide-react";
import { getSafeNext } from "@/lib/auth/redirect";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type Mode = "login" | "signup";
type AuthAction = "login" | "signup" | "resend";

async function submitAuth(action: AuthAction, email: string, next: string, password?: string) {
  const response = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, email, password, next }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    error?: string;
    session?: boolean;
  };

  return { error: result.error, session: result.session ?? false };
}

export function AuthForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(() =>
    searchParams.get("mode") === "login" ? "login" : "signup",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("auth") === "callback-error" ? "We could not confirm that sign-in link. Please try again." : null);
  const [success, setSuccess] = useState<string | null>(null);
  const next = getSafeNext(searchParams.get("next"));
  const supabaseConfigured = isSupabaseConfigured();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabaseConfigured) {
      setError("Member sign-in is being set up. Add the Supabase URL and publishable key to enable it.");
      return;
    }

    setError(null);
    setSuccess(null);
    setCanResendConfirmation(false);
    setIsLoading(true);

    try {
      if (mode === "login") {
        const { error: signInError } = await submitAuth("login", email, next, password);

        if (signInError) {
          const isEmailUnconfirmed = signInError.toLowerCase().includes("email not confirmed");
          setError(isEmailUnconfirmed ? "Please confirm your email before logging in." : signInError);
          setCanResendConfirmation(isEmailUnconfirmed);
          setIsLoading(false);
          return;
        }

        setSuccess("Welcome back. Opening your workspace…");
        window.location.assign(next);
        return;
      }

      const { session, error: signUpError } = await submitAuth("signup", email, next, password);

      if (signUpError) {
        const isRateLimited = signUpError.toLowerCase().includes("rate limit");
        setError(isRateLimited ? "Email sending is temporarily rate-limited. Wait a few minutes before trying again, or use Log in after confirming the account." : signUpError);
        setIsLoading(false);
        return;
      }

      if (session) {
        setSuccess("Your account is ready. Opening your workspace…");
        window.location.assign(next);
        return;
      }

      setSuccess("Check your email to confirm your account, then we’ll open your workspace.");
      setIsLoading(false);
    } catch {
      setError("We could not reach the sign-in service. Check your connection and try again.");
      setIsLoading(false);
    }
  }

  async function resendConfirmation() {
    if (!email || !supabaseConfigured) return;

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const { error: resendError } = await submitAuth("resend", email, next);

      if (resendError) {
        const isRateLimited = resendError.toLowerCase().includes("rate limit");
        setError(isRateLimited ? "Email sending is temporarily rate-limited. Wait a few minutes before requesting another confirmation email." : resendError);
        setIsLoading(false);
        return;
      }

      setSuccess("Confirmation email sent. Open the link, then you will be taken to your workspace.");
      setCanResendConfirmation(false);
      setIsLoading(false);
    } catch {
      setError("We could not reach the sign-in service. Check your connection and try again.");
      setIsLoading(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <section className="auth-card" id="member-access" aria-labelledby="auth-title">
      <div className="auth-tabs" role="tablist" aria-label="Account access">
        <button className={isLogin ? "active" : ""} type="button" role="tab" aria-selected={isLogin} onClick={() => { setMode("login"); setError(null); setSuccess(null); setCanResendConfirmation(false); }}>Log in</button>
        <button className={!isLogin ? "active" : ""} type="button" role="tab" aria-selected={!isLogin} onClick={() => { setMode("signup"); setError(null); setSuccess(null); setCanResendConfirmation(false); }}>Create account</button>
      </div>
      <div className="auth-card-copy">
        <div className="eyebrow">Member access</div>
        <h2 id="auth-title">{isLogin ? "Welcome back." : "Start building with us."}</h2>
        <p>{isLogin ? "Log in to continue where you left off." : "Create your account to enter the member workspace."}</p>
      </div>
      {!supabaseConfigured ? <p className="auth-message error" role="status">Member sign-in is temporarily unavailable while Supabase is configured.</p> : null}
      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="auth-email">Email</label>
        <input id="auth-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={isLoading || !supabaseConfigured} />
        <label htmlFor="auth-password">Password</label>
        <input id="auth-password" name="password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required disabled={isLoading || !supabaseConfigured} />
        {error ? <p className="auth-message error" role="alert">{error}</p> : null}
        {success ? <p className="auth-message success" role="status"><CheckCircle2 size={16} aria-hidden="true" />{success}</p> : null}
        {canResendConfirmation ? <button className="button button-secondary auth-submit" type="button" onClick={resendConfirmation} disabled={isLoading}>Resend confirmation email</button> : null}
        <button className="button auth-submit" type="submit" disabled={isLoading || !supabaseConfigured}>
          {isLoading ? "Please wait…" : isLogin ? "Log in" : "Create account"}
          {isLogin ? <LogIn size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
        </button>
      </form>
      {next !== "/member" ? <p className="auth-next">After authentication, you’ll continue to <strong>{next}</strong>.</p> : null}
    </section>
  );
}
