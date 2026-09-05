"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedAdminClaims } from "@/lib/auth/admin";
import { InvitationDeliveryError, inviteMember } from "@/lib/services/admin-member-invitations";
import { normalizeInvitationEmail } from "@/lib/validation/admin-invitations";

export type InvitationFormState = {
  status: "idle" | "error" | "success";
  message?: string;
};

/** Sends a member invitation after re-checking the caller's server-side allowlist entry. */
export async function sendMemberInvitation(
  _previousState: InvitationFormState,
  formData: FormData,
): Promise<InvitationFormState> {
  const claims = await getAuthenticatedAdminClaims();

  if (!claims?.sub) {
    return { status: "error", message: "Your administrator session has expired. Please sign in again." };
  }

  const email = normalizeInvitationEmail(formData.get("email"));

  if (!email) {
    return { status: "error", message: "Enter a valid email address." };
  }

  try {
    await inviteMember({ actorId: claims.sub, email });
  } catch (error) {
    if (error instanceof InvitationDeliveryError) {
      return { status: "error", message: error.message };
    }

    return { status: "error", message: "The invitation could not be prepared. Please try again." };
  }

  revalidatePath("/admin/members");
  return { status: "success", message: "Invitation sent." };
}
