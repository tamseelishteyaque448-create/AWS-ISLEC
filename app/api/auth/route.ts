import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getSafeNext } from "@/lib/auth/redirect";
import { getSupabaseEnv } from "@/lib/supabase/env";

type AuthAction = "login" | "signup" | "resend";

type AuthRequest = {
  action?: unknown;
  email?: unknown;
  password?: unknown;
  next?: unknown;
};

function isAuthAction(value: unknown): value is AuthAction {
  return value === "login" || value === "signup" || value === "resend";
}

function getText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  let body: AuthRequest;

  try {
    body = (await request.json()) as AuthRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const action = body.action;
  const email = getText(body.email);
  const password = getText(body.password);
  const next = getSafeNext(getText(body.next));

  if (!isAuthAction(action) || !email || (action !== "resend" && !password)) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  if (email.length > 320 || password.length > 1024) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { supabaseUrl, supabasePublishableKey } = getSupabaseEnv();
  const cookiesToSet: Array<{
    name: string;
    value: string;
    options: Parameters<NextResponse["cookies"]["set"]>[2];
  }> = [];
  const responseHeaders = new Headers();

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies, headers) {
        cookies.forEach(({ name, value, options }) => {
          cookiesToSet.push({ name, value, options });
        });

        Object.entries(headers).forEach(([name, value]) => {
          responseHeaders.set(name, value);
        });
      },
    },
  });

  function respond(payload: object, status = 200) {
    const response = NextResponse.json(payload, { status });
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    responseHeaders.forEach((value, name) => response.headers.set(name, value));
    return response;
  }

  try {
    if (action === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      return error
        ? respond({ error: error.message }, error.status ?? 400)
        : respond({ session: Boolean(data.session) });
    }

    const callbackUrl = new URL("/auth/callback", request.url);
    callbackUrl.searchParams.set("next", next);

    if (action === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callbackUrl.toString() },
      });
      return error
        ? respond({ error: error.message }, error.status ?? 400)
        : respond({ session: Boolean(data.session) });
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: callbackUrl.toString() },
    });
    return error ? respond({ error: error.message }, error.status ?? 400) : respond({ session: false });
  } catch {
    return respond({ error: "The authentication service is temporarily unavailable." }, 502);
  }
}
