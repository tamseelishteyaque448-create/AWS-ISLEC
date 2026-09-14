// Validation for admin project create and update forms.
// Aligned with Projects V1: status/progress/is_published are legacy DB
// columns managed by triggers; the authoritative fields are publication_state,
// build_stage, and recruitment_mode.  This module validates only the fields
// that the admin form actually submits to the RPC layer.

const BUILD_STAGES      = ["idea", "building", "prototype", "shipped"] as const;
const RECRUITMENT_MODES = ["open", "invite_only", "not_recruiting"] as const;

export type ProjectInput = {
  title:            string;
  category:         string;
  description:      string;
  technologies:     string[];
  build_stage:      typeof BUILD_STAGES[number];
  recruitment_mode: typeof RECRUITMENT_MODES[number];
  team_capacity:    number | null;
  repository_url:   string | null;
  demo_url:         string | null;
};

function text(value: FormDataEntryValue | null, maxLength: number, required = false): string | null {
  if (typeof value !== "string") return required ? null : "";
  const normalized = value.trim().replace(/\s+/g, " ");
  return (required && !normalized) || normalized.length > maxLength ? null : normalized;
}

function url(value: FormDataEntryValue | null): string | null | undefined {
  // undefined = not provided / empty (treat as null to the RPC)
  // null      = validation failure (malformed non-empty URL)
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const normalized = value.trim();
  if (normalized.length > 500 || !/^https?:\/\//i.test(normalized)) return null;

  try {
    const parsed = new URL(normalized);
    return parsed.hostname ? normalized : null;
  } catch {
    return null;
  }
}

export function getProjectId(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

export function validateProjectInput(
  formData: FormData,
): { data: ProjectInput } | { error: string } {
  const title       = text(formData.get("title"),       160, true);
  const category    = text(formData.get("category"),     80, true);
  const description = text(formData.get("description"), 2000);

  const buildStageRaw      = formData.get("build_stage");
  const recruitmentRaw     = formData.get("recruitment_mode");
  const capacityRaw        = formData.get("team_capacity");
  const repositoryRaw      = formData.get("repository_url");
  const demoRaw            = formData.get("demo_url");

  const rawTechnologies = formData.get("technologies");
  const technologies: string[] =
    typeof rawTechnologies === "string"
      ? [...new Set(rawTechnologies.split(",").map((v) => v.trim()).filter(Boolean))]
      : [];

  // Validate required text fields.
  if (!title || !category || description === null) {
    return { error: "Check the project title, category, and description." };
  }

  // Build stage.
  const build_stage = typeof buildStageRaw === "string" && BUILD_STAGES.includes(buildStageRaw as typeof BUILD_STAGES[number])
    ? (buildStageRaw as typeof BUILD_STAGES[number])
    : null;
  if (!build_stage) return { error: "Select a valid build stage." };

  // Recruitment mode.
  const recruitment_mode = typeof recruitmentRaw === "string" && RECRUITMENT_MODES.includes(recruitmentRaw as typeof RECRUITMENT_MODES[number])
    ? (recruitmentRaw as typeof RECRUITMENT_MODES[number])
    : null;
  if (!recruitment_mode) return { error: "Select a valid recruitment mode." };

  // Team capacity (optional positive integer ≤ 100).
  let team_capacity: number | null = null;
  if (typeof capacityRaw === "string" && capacityRaw.trim() !== "") {
    const n = Number(capacityRaw);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      return { error: "Team capacity must be a whole number between 1 and 100." };
    }
    team_capacity = n;
  }

  // Technologies.
  if (technologies.length > 12) {
    return { error: "Choose 12 technologies or fewer." };
  }
  if (technologies.some((v) => v.length > 60)) {
    return { error: "Each technology name must be 60 characters or fewer." };
  }

  // URLs (optional).
  const repoResult = url(repositoryRaw);
  const demoResult = url(demoRaw);
  if (repoResult === null) return { error: "Repository URL must start with http:// or https://." };
  if (demoResult === null) return { error: "Demo URL must start with http:// or https://." };

  return {
    data: {
      title,
      category,
      description:      description ?? "",
      technologies,
      build_stage,
      recruitment_mode,
      team_capacity,
      repository_url:   repoResult  ?? null,
      demo_url:         demoResult  ?? null,
    },
  };
}

export function makeProjectSlug(title: string): string {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 110) || "project";
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}
