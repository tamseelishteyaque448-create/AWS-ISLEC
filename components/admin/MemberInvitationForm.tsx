"use client";

import { useActionState, useEffect, useRef } from "react";
import { MailPlus } from "lucide-react";
import {
  sendMemberInvitation,
} from "@/app/admin/members/actions";
import type { InvitationFormState } from "@/app/admin/members/actions";

const initialInvitationFormState: InvitationFormState = { status: "idle" };

export function MemberInvitationForm() {
  const [state, action, pending] = useActionState(sendMemberInvitation, initialInvitationFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return <section className="admin-invitation" aria-labelledby="member-invitation-title">
    <div className="admin-invitation-icon"><MailPlus size={20} aria-hidden="true" /></div>
    <div>
      <div className="eyebrow">Grow the community</div>
      <h2 id="member-invitation-title">Invite a member.</h2>
      <p>Send a secure account invitation. The recipient chooses their own password.</p>
      <form action={action} ref={formRef} className="admin-invitation-form">
        <label htmlFor="member-invitation-email">Email address</label>
        <div>
          <input id="member-invitation-email" name="email" type="email" autoComplete="email" maxLength={320} required placeholder="member@example.com" />
          <button className="button" type="submit" disabled={pending}>{pending ? "Sending…" : "Send invite"}</button>
        </div>
        <p className={`admin-invitation-message ${state.status}`} aria-live="polite">{state.message}</p>
      </form>
    </div>
  </section>;
}
