import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/lib/types/database";

export function createClient() {
  const { supabaseUrl, supabasePublishableKey } = getSupabaseEnv();
  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
}
