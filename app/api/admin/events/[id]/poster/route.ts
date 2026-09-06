import { getAuthenticatedAdminClaims } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id) || !(await getAuthenticatedAdminClaims())) return new Response(null, { status: 404 });

  const supabase = await createClient();
  const { data: event, error: eventError } = await supabase.from("events").select("poster_path").eq("id", id).maybeSingle();
  if (eventError) return new Response("Poster is temporarily unavailable.", { status: 500 });
  if (!event?.poster_path) return new Response(null, { status: 404 });

  const { data: poster, error: posterError } = await supabase.storage.from("event-posters").download(event.poster_path);
  if (posterError || !poster) return new Response("Poster is temporarily unavailable.", { status: 500 });

  return new Response(poster, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": poster.type || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
