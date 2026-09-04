import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type AdminClient = SupabaseClient<Database>;

export class AdminAuditError extends Error {
  constructor() {
    super("Unable to record the administrative action.");
  }
}

export async function writeInvitationAuditIntent(client: AdminClient, actorId: string, emailDomain: string) {
  const { data, error } = await client
    .from("admin_audit_log")
    .insert({
      actor_id: actorId,
      action: "member.invite_requested",
      target_type: "member",
      metadata: { email_domain: emailDomain, outcome: "pending" },
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new AdminAuditError();
  }

  return data.id;
}

export async function completeInvitationAudit(
  client: AdminClient,
  auditId: string,
  emailDomain: string,
  outcome: "failed" | "sent",
  targetId?: string,
) {
  const { error } = await client
    .from("admin_audit_log")
    .update({
      target_id: targetId ?? null,
      metadata: { email_domain: emailDomain, outcome },
    })
    .eq("id", auditId);

  if (error) {
    throw new AdminAuditError();
  }
}
