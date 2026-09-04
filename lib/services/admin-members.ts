import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database";

export const ADMIN_MEMBER_PAGE_SIZE = 20;
const MAX_SEARCH_LENGTH = 80;

export type AdminMember = Pick<
  Tables<"profiles">,
  "id" | "full_name" | "handle" | "avatar_url" | "points" | "streak" | "created_at" | "updated_at"
>;

export function getMemberDirectorySearch(value: string | string[] | undefined) {
  const search = typeof value === "string" ? value.trim().slice(0, MAX_SEARCH_LENGTH) : "";

  // Keep PostgREST filter syntax out of a user-controlled .or() expression.
  return search.replace(/[^A-Za-z0-9 @_-]/g, "");
}

export function getMemberDirectoryPage(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return 1;
  }

  return Math.min(Math.max(Number(value), 1), 10_000);
}

export async function getAdminMembers({ page, search }: { page: number; search: string }) {
  const supabase = await createClient();
  async function fetchMembers(requestedPage: number) {
    const from = (requestedPage - 1) * ADMIN_MEMBER_PAGE_SIZE;
    let query = supabase
      .from("profiles")
      .select("id, full_name, handle, avatar_url, points, streak, created_at, updated_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + ADMIN_MEMBER_PAGE_SIZE - 1);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,handle.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error("Unable to load the member directory.");
    }

    return { members: (data ?? []) as AdminMember[], total: count ?? 0 };
  }

  const initialResult = await fetchMembers(page);
  const lastPage = Math.max(Math.ceil(initialResult.total / ADMIN_MEMBER_PAGE_SIZE), 1);

  if (initialResult.total > 0 && page > lastPage) {
    const correctedResult = await fetchMembers(lastPage);
    return { ...correctedResult, page: lastPage };
  }

  return { ...initialResult, page };
}
