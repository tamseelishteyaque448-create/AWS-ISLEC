import { getAuthenticatedClaims } from "@/lib/auth/session";
import { buildProveEvidenceErrorResponse } from "@/lib/http/build-prove-evidence";
import { uploadBuildDraftEvidence } from "@/lib/services/build-prove";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const claims = await getAuthenticatedClaims();
  if (typeof claims?.sub !== "string" || !claims.sub) {
    return Response.json(
      { error: "Sign in to manage Build & Prove evidence.", code: "unauthenticated" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "The evidence upload request is invalid.", code: "invalid_input" },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const draftId = formData.get("draftId");
  const file = formData.get("file");
  const captionValue = formData.get("caption");
  const caption = typeof captionValue === "string" ? captionValue : "";
  if (
    typeof draftId !== "string"
    || !UUID_PATTERN.test(draftId)
    || typeof File === "undefined"
    || !(file instanceof File)
    || caption.length > 500
  ) {
    return Response.json(
      { error: "The evidence upload request is invalid.", code: "invalid_input" },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    const evidence = await uploadBuildDraftEvidence(draftId, file, caption);
    return Response.json(
      { evidence },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return buildProveEvidenceErrorResponse(error);
  }
}
