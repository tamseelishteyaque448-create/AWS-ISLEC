export const dynamic = "force-dynamic";
export const revalidate = 0;

function isLoopbackHost(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "localhost";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const supabaseValue = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const expectedPort = process.env.E2E_SUPABASE_PORT;

  if (
    process.env.E2E_ENV !== "local-disposable" ||
    !isLoopbackHost(requestUrl.hostname) ||
    !supabaseValue ||
    !expectedPort
  ) {
    return new Response(null, { status: 404 });
  }

  let supabaseUrl: URL;
  try {
    supabaseUrl = new URL(supabaseValue);
  } catch {
    return new Response(null, { status: 404 });
  }

  if (
    supabaseUrl.protocol !== "http:" ||
    supabaseUrl.hostname !== "127.0.0.1" ||
    supabaseUrl.port !== expectedPort ||
    supabaseUrl.pathname !== "/" ||
    supabaseUrl.search ||
    supabaseUrl.hash
  ) {
    return new Response(null, { status: 404 });
  }

  return Response.json(
    {
      environment: "local-disposable",
      backend: {
        host: supabaseUrl.hostname,
        port: Number(supabaseUrl.port),
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
