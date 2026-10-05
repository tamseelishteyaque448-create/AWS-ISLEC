import { getAuthenticatedClaims } from "@/lib/auth/session";
import { buildProveEvidenceErrorResponse } from "@/lib/http/build-prove-evidence";
import {
  downloadBuildEvidence,
  removeBuildDraftEvidence,
} from "@/lib/services/build-prove";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXTENSION_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
} as const;

type RouteContext = { params: Promise<{ evidenceId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const claims = await getAuthenticatedClaims();
  if (typeof claims?.sub !== "string" || !claims.sub) {
    return Response.json(
      { error: "Sign in to access Build & Prove evidence.", code: "unauthenticated" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const { evidenceId } = await context.params;
  if (!UUID_PATTERN.test(evidenceId)) {
    return Response.json(
      { error: "Evidence was not found.", code: "evidence_not_found" },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    const file = await downloadBuildEvidence(evidenceId);
    return new Response(file.body, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="build-evidence-${evidenceId}.${EXTENSION_BY_TYPE[file.contentType]}"`,
        "Content-Length": String(file.fileSize),
        "Content-Type": file.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return buildProveEvidenceErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const claims = await getAuthenticatedClaims();
  if (typeof claims?.sub !== "string" || !claims.sub) {
    return Response.json(
      { error: "Sign in to manage Build & Prove evidence.", code: "unauthenticated" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const { evidenceId } = await context.params;
  if (!UUID_PATTERN.test(evidenceId)) {
    return Response.json(
      { error: "Evidence was not found.", code: "evidence_not_found" },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    await removeBuildDraftEvidence(evidenceId);
    return Response.json(
      { removed: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return buildProveEvidenceErrorResponse(error);
  }
}
