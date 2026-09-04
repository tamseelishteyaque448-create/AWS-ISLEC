import { NextRequest, NextResponse } from "next/server";
import { getSafeNext } from "@/lib/auth/redirect";
import { getWorkspaceDestination } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = getSafeNext(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      try {
        return NextResponse.redirect(new URL(await getWorkspaceDestination(supabase), request.url));
      } catch {
        // Fall through to the existing safe callback-error response.
      }
    }
  }

  const joinUrl = new URL("/join", request.url);
  joinUrl.searchParams.set("next", next);
  joinUrl.searchParams.set("auth", "callback-error");
  return NextResponse.redirect(joinUrl);
}
