import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getWorkspaceDestination } from "@/lib/auth/workspace";

type AuthAction = "login";

type AuthRequest = {
  action?: unknown;
  email?: unknown;
  password?: unknown;
  next?: unknown;
};

function isAuthAction(value: unknown): value is AuthAction {
  return value === "login";
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
  if (!isAuthAction(action) || !email || !password) {
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return respond({ error: error.message }, error.status ?? 400);
    }

    if (!data.session) {
      return respond({ error: "The authentication service did not create a session." }, 502);
    }

    return respond({ destination: await getWorkspaceDestination(supabase) });
  } catch {
    return respond({ error: "The authentication service is temporarily unavailable." }, 502);
  }
}
