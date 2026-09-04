const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function isValidSupabaseUrl(value: string | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function isSupabaseConfigured() {
  return Boolean(isValidSupabaseUrl(supabaseUrl) && supabasePublishableKey);
}

export function getSupabaseEnv() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Add a valid NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local.",
    );
  }

  return { supabaseUrl: supabaseUrl!, supabasePublishableKey: supabasePublishableKey! };
}
