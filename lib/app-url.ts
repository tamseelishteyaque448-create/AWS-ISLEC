import "server-only";

export function getAppUrl() {
  const value = process.env.APP_URL;

  if (!value) {
    throw new Error("APP_URL is required for invitation redirects.");
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("APP_URL must be a valid absolute URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("APP_URL must use HTTP or HTTPS.");
  }

  return url;
}
