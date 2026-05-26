# World Action Model Atlas

Static GitHub Pages site for an interactive survey of video action models / world action models.

## Current Workflow

1. Download missing arXiv papers into the local paper folder:
   `scripts/download-missing-papers.ps1`
2. Extract method, architecture, training, dataset, and implementation sections:
   `node scripts/extract-method-sections.mjs`
3. Curate literal architecture specs from `methods/*.md` into:
   `data/architecture-specs.json`
4. Render the static site from:
   `index.html`, `styles.css`, `js/app.js`

The important distinction is that `data/wam-models.json` contains survey-level model cards, while `data/architecture-specs.json` contains source-backed literal architecture diagrams. Only models listed in `curationStatus.completeEnoughForRendering` should be treated as having literal architecture diagrams.

## Source-Backed Diagram Batch

The first curated batch covers:

- `gr-2`
- `vpp`
- `uwm`
- `flare`
- `univla`
- `dust`
- `fast-wam`
- `gigaworld-policy`
- `x-wam`

The rest of the atlas currently renders survey-level scaffolds and is explicitly marked as pending method-section curation.

## Run Locally

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173`.
