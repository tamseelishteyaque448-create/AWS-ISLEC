import { getAuthenticatedClaims } from "@/lib/auth/session";
import {
  BuildProveQueryError,
  BuildProveUnauthenticatedError,
  downloadBuildAssignmentReference,
} from "@/lib/services/build-prove";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXTENSION_BY_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type RouteContext = { params: Promise<{ attachmentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const claims = await getAuthenticatedClaims();
  if (typeof claims?.sub !== "string" || !claims.sub) {
    return Response.json(
      { error: "Sign in to access Build & Prove references.", code: "unauthenticated" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const { attachmentId } = await context.params;
  if (!UUID_PATTERN.test(attachmentId)) {
    return Response.json(
      { error: "Reference file was not found.", code: "reference_not_found" },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    const file = await downloadBuildAssignmentReference(attachmentId);
    if (!file) {
      return Response.json(
        { error: "Reference file was not found.", code: "reference_not_found" },
        { status: 404, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const contentType = EXTENSION_BY_TYPE[file.contentType]
      ? file.contentType
      : "application/octet-stream";
    const extension = EXTENSION_BY_TYPE[file.contentType] ?? "bin";
    return new Response(file.body, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="build-reference-${attachmentId}.${extension}"`,
        "Content-Length": String(file.fileSize),
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof BuildProveUnauthenticatedError) {
      return Response.json(
        { error: "Sign in to access Build & Prove references.", code: "unauthenticated" },
        { status: 401, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    if (error instanceof BuildProveQueryError) {
      return Response.json(
        { error: "Reference file is temporarily unavailable.", code: "reference_unavailable" },
        { status: 500, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    throw error;
  }
}
