# Feature Track Spec Reference

This skill follows the repository spec at `spec/feature-track-spec.md`.

Installed copies should treat this file as the local reference.

## Canonical Structure

```text
docs/features/
├── README.md
└── <feature-id>/
    ├── README.md
    ├── prd/
    ├── api/
    ├── plans/
    └── archive/
```

## Core Rules

- `docs/features/README.md` is the global feature index.
- `docs/features/<feature-id>/README.md` is the current summary for one feature.
- Feature tracks summarize current truth and link to detailed PRD, API, design, and plan documents.
- Use lowercase hyphen-case feature ids for new tracks.
- Link existing docs before migrating old projects.
- Do not duplicate full source documents in the feature README.
- Mark superseded documents clearly or move them to `archive/` when safe.
- Update the track before finishing feature work.

## Required Feature README Sections

- `Current Status`
- `Source Of Truth`
- `Current Behavior`
- `Decisions`
- `Known Risks`
- `Changelog`

Equivalent project-local headings are acceptable when clear and consistent.

## Recommended Statuses

- `active`
- `stable`
- `paused`
- `deprecated`

Project-local statuses are acceptable when already established.

