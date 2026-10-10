export function assertLegacyApprovalFixtureResult(output) {
  let result;
  try {
    result = JSON.parse(output);
  } catch {
    throw new Error("Supabase CLI returned invalid JSON for the legacy approval fixture.");
  }

  if (
    result === null ||
    typeof result !== "object" ||
    Array.isArray(result) ||
    typeof result.boundary !== "string" ||
    typeof result.warning !== "string" ||
    !Array.isArray(result.rows) ||
    result.rows.length !== 1
  ) {
    throw new Error("Supabase CLI returned an unexpected JSON result envelope for the legacy approval fixture.");
  }

  const [row] = result.rows;
  if (
    row === null ||
    typeof row !== "object" ||
    Array.isArray(row) ||
    !Object.hasOwn(row, "inserted_reviews") ||
    !Number.isSafeInteger(row.inserted_reviews)
  ) {
    throw new Error("Supabase CLI returned an unexpected JSON result envelope for the legacy approval fixture.");
  }

  if (row.inserted_reviews !== 1) {
    throw new Error(
      `Local legacy approval fixture inserted ${row.inserted_reviews} reviews; expected exactly one.`,
    );
  }
}
