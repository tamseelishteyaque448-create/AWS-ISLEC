import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const supabase = await createClient();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("poster_path")
    .eq("slug", slug)
    .eq("is_published", true)
    .neq("status", "cancelled")
    .maybeSingle();

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
