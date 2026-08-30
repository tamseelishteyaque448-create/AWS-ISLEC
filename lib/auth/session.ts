import { createClient } from "@/lib/supabase/server";

/**
 * Verifies the current access token and returns its claims.
 * Use this in future Server Components, Server Actions, and Route Handlers
 * before accessing member-specific data.
 */
export async function getAuthenticatedClaims() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    return null;
  }

  return data.claims;
}
