const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DisposableProjectFixtures = {
  deleteProjectId: string;
  archivedProjectId: string;
  pendingReviewProjectId: string;
};

export function getDisposableProjectFixtures(
  env: Record<string, string | undefined> = process.env,
): DisposableProjectFixtures {
  const entries = [
    ["E2E_DELETE_PROJECT_ID", "deleteProjectId"],
    ["E2E_ARCHIVED_PROJECT_ID", "archivedProjectId"],
    ["E2E_PENDING_PROJECT_ID", "pendingReviewProjectId"],
  ] as const;
  const ids = entries.map(([key]) => {
    const value = env[key];
    if (!value || !uuidPattern.test(value)) {
      throw new Error(`${key} must identify an explicitly provisioned disposable project.`);
    }
    return value;
  });

  if (new Set(ids).size !== ids.length) {
    throw new Error("Each disposable project lifecycle requires a distinct project ID.");
  }

  return {
    deleteProjectId: ids[0],
    archivedProjectId: ids[1],
    pendingReviewProjectId: ids[2],
  };
}
