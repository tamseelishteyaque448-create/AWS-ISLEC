import "server-only";
import { completeInvitationAudit, writeInvitationAuditIntent } from "@/lib/audit/admin";
import { getAppUrl } from "@/lib/app-url";
import { createAdminClient } from "@/lib/supabase/admin";

export class InvitationDeliveryError extends Error {
  constructor() {
    super("The invitation could not be sent.");
  }
}

export async function inviteMember({ actorId, email }: { actorId: string; email: string }) {
  const client = createAdminClient();
  const emailDomain = email.slice(email.lastIndexOf("@") + 1);
  const auditId = await writeInvitationAuditIntent(client, actorId, emailDomain);
  // Invite links establish their session in the browser URL fragment, so they
  // must land on the browser onboarding page instead of the server callback.
  const inviteUrl = new URL("/auth/invite", getAppUrl()).toString();
  const { data, error } = await client.auth.admin.inviteUserByEmail(email, { redirectTo: inviteUrl });

  if (error || !data.user?.id) {
    await completeInvitationAudit(client, auditId, emailDomain, "failed").catch(() => undefined);
    throw new InvitationDeliveryError();
  }

  await completeInvitationAudit(client, auditId, emailDomain, "sent", data.user.id);
}
