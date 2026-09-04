import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/lib/types/database";

export function createClient() {
  const { supabaseUrl, supabasePublishableKey } = getSupabaseEnv();
  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: {
      // Invitation links use Supabase's browser-only implicit flow. The client
      // consumes the session from the URL fragment and persists it in cookies.
      detectSessionInUrl: true,
    },
  });
}
