import {
  BuildProveEvidenceOperationError,
  BuildProveQueryError,
  BuildProveUnauthenticatedError,
} from "@/lib/services/build-prove";

const STATUS_BY_CODE = {
  unauthenticated: 401,
  invalid_input: 400,
  draft_unavailable: 404,
  draft_conflict: 409,
  draft_sealed: 409,
  cancelled: 409,
  invalid_file: 400,
  file_too_large: 413,
  unsupported_mime: 415,
  signature_mismatch: 415,
  storage_upload_failed: 502,
  evidence_registration_failed: 502,
  evidence_not_found: 404,
  forbidden: 403,
  storage_delete_failed: 502,
  evidence_cleanup_required: 500,
  storage_object_missing: 404,
} satisfies Record<BuildProveEvidenceOperationError["code"], number>;

export function buildProveEvidenceErrorResponse(error: unknown): Response {
  if (error instanceof BuildProveUnauthenticatedError) {
    return Response.json(
      { error: "Sign in to access Build & Prove evidence.", code: "unauthenticated" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  if (error instanceof BuildProveEvidenceOperationError) {
    return Response.json(
      {
        error: error.message,
        code: error.code,
        ...(error.diagnosticId ? { diagnosticId: error.diagnosticId } : {}),
      },
      {
        status: STATUS_BY_CODE[error.code],
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
  if (error instanceof BuildProveQueryError) {
    return Response.json(
      { error: "Build & Prove evidence is temporarily unavailable." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return Response.json(
    { error: "Build & Prove evidence is temporarily unavailable." },
    { status: 500, headers: { "Cache-Control": "private, no-store" } },
  );
}
