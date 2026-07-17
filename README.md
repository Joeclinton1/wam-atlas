# World Action Model Atlas

Static GitHub Pages site for an interactive survey of video action models / world action models.

## Current Workflow

1. Download missing arXiv papers into the local paper folder:
   `scripts/download-missing-papers.ps1`
2. Extract method, architecture, training, dataset, and implementation sections:
   `node scripts/extract-method-sections.mjs`
3. Curate each paper's inputs, tokenizers, backbone, branches, heads, objectives, and runtime path in `data/wam-models.json`.
4. Generate and validate the renderer-compatible paper profiles:
   `node scripts/generate-diagram-profiles.mjs`
   `node scripts/validate-diagram-profiles.mjs`
5. Render the static site from:
   `index.html`, `styles.css`, `js/app.js`

`data/diagram-profiles.json` contains a paper-specific profile for every atlas entry. The profiles preserve the original visual renderer while supplying each paper's own core, encoders, streams, heads, training signals, runtime path, source extract, and source-coverage level. `data/architecture-specs.json` remains the stricter node-and-edge representation for the subset whose graph topology has been separately curated.

## Diagram Coverage

All 67 atlas papers have paper-specific diagram profiles. The validator checks that every profile:

- points to a local method extract;
- declares its paper-specific architectural core;
- includes inputs, outputs, training signals, and runtime behavior;
- renders successfully in full-card, hover-preview, and gallery modes.

Abstract-level sources show their coverage level rather than having missing internals filled from a family template.

## Run Locally

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173`.
