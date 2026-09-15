const fallbackDestination = "/member";
const localOrigin = "http://localhost";

/** Returns a safe local workspace redirect destination. */
export function getSafeNext(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallbackDestination;
  }

  try {
    const destination = new URL(next, localOrigin);

    if (
      destination.origin !== localOrigin ||
      !(
        destination.pathname === "/member" ||
        destination.pathname.startsWith("/member/") ||
        destination.pathname === "/admin" ||
        destination.pathname.startsWith("/admin/")
      )
    ) {
      return fallbackDestination;
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallbackDestination;
  }
}
