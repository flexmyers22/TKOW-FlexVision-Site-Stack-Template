# OpenCV Surface Placement Workbench — Site Source Package

This ZIP contains the static source for the private Sites publication **OpenCV Surface Placement Workbench**.

## Package contents

- `dist/index.html` — app shell and navigation
- `dist/styles.css` — responsive layout and print styles
- `dist/app.js` — browser-local workspace, seeded research records, forms, code sample, and exports
- `.openai/hosting.json` — Sites project identity and static deployment directory

## Behavior

- Records persist in the current browser's `localStorage`.
- CSV files are Excel-ready; the app also exports JSON, Markdown, print-to-PDF, and ZIP.
- The included Python sample is a still-image planar overlay starter using manually supplied corners. It is labeled Proposed and has not been executed or validated.
- Research citations, research findings, experiment runs, and validation results are distinct records with explicit status values.
- No database, external integration, evidence upload service, or cloud package storage is configured.

## Deployment

This is a buildless static site. The hosting manifest serves `dist/`. Make source changes through the Sites-managed repository workflow so the saved source version and published version stay aligned.
