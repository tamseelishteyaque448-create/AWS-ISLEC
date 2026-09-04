"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, LogIn } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";

async function submitAuth(email: string, password: string) {
  const response = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "login", email, password }),
  });
  const result = (await response.json().catch(() => ({}))) as { destination?: string; error?: string };

  return { destination: result.destination, error: result.error };
}

export function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Successful authentication always selects its destination on the server.
  const next = "/member";
  const supabaseConfigured = isSupabaseConfigured();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabaseConfigured) {
      setError("Member sign-in is being set up. Add the Supabase URL and publishable key to enable it.");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const { destination, error: signInError } = await submitAuth(email, password);

      if (signInError) {
        const invalidCredentials = signInError.toLowerCase().includes("invalid login credentials");
        setError(invalidCredentials ? "This email and password do not match a registered member account." : signInError);
        setIsLoading(false);
        return;
      }

      setSuccess("Welcome back. Opening your workspace…");
      if (destination !== "/admin" && destination !== "/member") {
        throw new Error("The sign-in service returned an invalid workspace.");
      }

      window.location.assign(destination);
    } catch {
      setError("We could not reach the sign-in service. Check your connection and try again.");
      setIsLoading(false);
    }
  }

  return (
    <section className="auth-card" id="member-access" aria-labelledby="auth-title">
      <div className="auth-card-copy">
        <div className="eyebrow">Member access</div>
        <h2 id="auth-title">Welcome back.</h2>
        <p>Log in with the credentials provided by AWS ISLEC to enter the member workspace.</p>
      </div>
      {!supabaseConfigured ? <p className="auth-message error" role="status">Member sign-in is temporarily unavailable while Supabase is configured.</p> : null}
      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="auth-email">Email</label>
        <input id="auth-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={isLoading || !supabaseConfigured} />
        <label htmlFor="auth-password">Password</label>
        <input id="auth-password" name="password" type="password" autoComplete="current-password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required disabled={isLoading || !supabaseConfigured} />
        {error ? <p className="auth-message error" role="alert">{error}</p> : null}
        {success ? <p className="auth-message success" role="status"><CheckCircle2 size={16} aria-hidden="true" />{success}</p> : null}
        <button className="button auth-submit" type="submit" disabled={isLoading || !supabaseConfigured}>
          {isLoading ? "Please wait…" : "Log in"}
          <LogIn size={16} aria-hidden="true" />
        </button>
      </form>
      {next !== "/member" ? <p className="auth-next">After authentication, you’ll continue to <strong>{next}</strong>.</p> : null}
    </section>
  );
}
