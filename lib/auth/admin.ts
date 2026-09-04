import "server-only";
import { redirect } from "next/navigation";
import { getAuthenticatedClaims } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns the authenticated administrator's claims or redirects to the safe
 * member entry point. Authorization comes from private.admin_users, never
 * from profiles.role or browser-provided data.
 */
export async function requireAdmin() {
  const claims = await getAuthenticatedClaims();

  if (!claims?.sub) {
    redirect("/join?mode=login&next=/admin");
  }

  const supabase = await createClient();
  const { data: isAdmin, error } = await supabase.rpc("is_admin");

  if (error || !isAdmin) {
    redirect("/member");
  }

  return claims;
}
