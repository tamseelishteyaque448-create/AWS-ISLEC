import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export type WorkspaceDestination = "/admin" | "/member";

/** Resolves a workspace exclusively from the database-backed admin allowlist. */
export async function getWorkspaceDestination(
  supabase: Pick<SupabaseClient<Database>, "rpc">,
): Promise<WorkspaceDestination> {
  const { data: isAdmin, error } = await supabase.rpc("is_admin");

  if (error) {
    throw new Error("Unable to determine the authenticated user's workspace.");
  }

  return isAdmin ? "/admin" : "/member";
}
