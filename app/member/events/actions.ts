"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedClaims } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type EventRegistrationState = { status: "idle" | "success" | "error"; message?: string };
export const initialEventRegistrationState: EventRegistrationState = { status: "idle" };

async function changeRegistration(formData: FormData, action: "register_for_event" | "cancel_event_registration"): Promise<EventRegistrationState> {
  const claims = await getAuthenticatedClaims();
  if (!claims?.sub) return { status: "error", message: "Please sign in to manage your registration." };
  const eventId = formData.get("event_id");
  if (typeof eventId !== "string" || !UUID_PATTERN.test(eventId)) return { status: "error", message: "That event is invalid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc(action, { p_event_id: eventId.toLowerCase() });
  if (error) return { status: "error", message: action === "register_for_event" ? "Registration is unavailable. The event may be full or closed." : "This registration can no longer be cancelled." };
  revalidatePath("/member/events");
  revalidatePath("/admin/events");
  return { status: "success", message: action === "register_for_event" ? "You are registered." : "Your registration has been cancelled." };
}

export async function registerForEvent(_previousState: EventRegistrationState, formData: FormData) { return changeRegistration(formData, "register_for_event"); }
export async function cancelEventRegistration(_previousState: EventRegistrationState, formData: FormData) { return changeRegistration(formData, "cancel_event_registration"); }
