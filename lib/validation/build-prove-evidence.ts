export type BuildProveEvidenceMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "application/pdf";

export type BuildProveEvidenceValidationCode =
  | "invalid_file"
  | "file_too_large"
  | "unsupported_mime"
  | "signature_mismatch";

export class BuildProveEvidenceValidationError extends Error {
  constructor(readonly code: BuildProveEvidenceValidationCode) {
    super(code);
    this.name = "BuildProveEvidenceValidationError";
  }
}

const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024;

function isAllowedMimeType(value: string): value is BuildProveEvidenceMimeType {
  return value === "image/jpeg"
    || value === "image/png"
    || value === "image/webp"
    || value === "application/pdf";
}

function matchesSignature(
  contentType: BuildProveEvidenceMimeType,
  header: Uint8Array,
  fileSize: number,
): boolean {
  if (contentType === "image/jpeg") {
    return header.length >= 3
      && header[0] === 0xff
      && header[1] === 0xd8
      && header[2] === 0xff;
  }
  if (contentType === "image/png") {
    return header.length >= 8
      && header[0] === 0x89
      && header[1] === 0x50
      && header[2] === 0x4e
      && header[3] === 0x47
      && header[4] === 0x0d
      && header[5] === 0x0a
      && header[6] === 0x1a
      && header[7] === 0x0a;
  }
  if (contentType === "image/webp") {
    if (
      header.length < 12
      || header[0] !== 0x52
      || header[1] !== 0x49
      || header[2] !== 0x46
      || header[3] !== 0x46
      || header[8] !== 0x57
      || header[9] !== 0x45
      || header[10] !== 0x42
      || header[11] !== 0x50
    ) {
      return false;
    }
    const riffSize = new DataView(header.buffer, header.byteOffset, header.byteLength)
      .getUint32(4, true);
    return riffSize >= 4 && riffSize + 8 === fileSize;
  }
  return header.length >= 5
    && header[0] === 0x25
    && header[1] === 0x50
    && header[2] === 0x44
    && header[3] === 0x46
    && header[4] === 0x2d;
}

export async function validateBuildProveEvidenceFile(
  file: File,
): Promise<BuildProveEvidenceMimeType> {
  if (file.size === 0) {
    throw new BuildProveEvidenceValidationError("invalid_file");
  }
  if (file.size > MAX_EVIDENCE_SIZE) {
    throw new BuildProveEvidenceValidationError("file_too_large");
  }

  if (!isAllowedMimeType(file.type)) {
    throw new BuildProveEvidenceValidationError("unsupported_mime");
  }

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!matchesSignature(file.type, header, file.size)) {
    throw new BuildProveEvidenceValidationError("signature_mismatch");
  }
  return file.type;
}
