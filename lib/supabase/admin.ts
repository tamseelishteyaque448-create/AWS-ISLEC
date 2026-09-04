import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

function getAdminEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      "Admin Supabase access requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.",
    );
  }

  return { supabaseUrl, supabaseSecretKey };
}

/**
 * Creates a server-only, RLS-bypassing client for narrowly scoped admin operations.
 * Callers must authorize the signed-in requester before using this client.
 */
export function createAdminClient() {
  const { supabaseUrl, supabaseSecretKey } = getAdminEnv();

  return createClient<Database>(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
