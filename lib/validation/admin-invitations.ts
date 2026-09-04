const MAX_EMAIL_LENGTH = 320;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeInvitationEmail(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const email = value.trim().toLowerCase();

  if (!email || email.length > MAX_EMAIL_LENGTH || !emailPattern.test(email)) {
    return null;
  }

  return email;
}
