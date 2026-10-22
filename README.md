# Praja Vani (ప్రజా వాణి) — AI-Powered Telugu Newspaper Publishing System

An end-to-end Telugu daily newspaper publishing platform that accepts field dispatches and photographs from multiple regional reporters, orchestrates two Google AI models (`gemma-4-31b-it` and `gemini-3.5-flash-lite`), and composes asymmetric, print-ready multi-page Telugu broadsheet newspapers through a **DESIGNER + EDITOR** engine with a deterministic measurement and feedback loop.

---

## 1. Architecture Overview

### Editorial Preparation Pipeline
1. **Model A — `gemma-4-31b-it` (News Classification & Editorial Metadata)**:
   - Classifies Telugu reporter dispatches into configurable newspaper sections (`State news`, `Agriculture`, `Education`, `Public services`, `Health`, `Crime`, `Announcements`, etc.).
   - Extracts principal subject, location, district, event date, and named entities.
   - Computes local relevance score (`1–100`) and priority score (`1–100`) with a rationale.
   - Identifies duplicate/related candidate reports and flags missing source facts or unverified serious allegations without inventing facts or inferring guilt.

2. **Model B — `gemini-3.5-flash-lite` (Telugu Story Preparation)**:
   - Polishes reporter submissions into publication-ready Telugu journalistic prose while strictly preserving source facts, numbers, dates, names, and quotations.
   - Generates primary wide-column headlines (`primaryHeadlineTelugu`), compact narrow-column headlines (`compactHeadlineTelugu`), standfirsts (`standfirstTelugu`), summaries, verified photo captions, and full/short paragraph variants (`bodyParagraphsFullTelugu`, `bodyParagraphsShortTelugu`).

### Designer + Editor Newspaper Publishing Engine (`/src/engine/`)
The newspaper layout and rendering system is built around two primary components connected by a closed-loop measurement and revision cycle:

- **`src/engine/designer-service.ts` — COMPONENT 1: DESIGNER (The Mind — `gemini-3.5-flash-lite`)**:
  - Receives all classified and prepared Telugu articles, photo asset dimensions, and actual Telugu text measurements supplied by the Editor.
  - Reasons over the entire edition and produces a schema-validated `MasterLayoutPlan` JSON (`coordinate_system: { unit: "mm", origin: "top_left" }`) specifying exact `x, y, width, height` coordinates, reading order, z-index, typography, multi-column text flow, image fitting rules, and `permitted_actions` for every element across all pages.
  - Creates varied, asymmetric broadsheet compositions across pages (e.g., Page 1 features an asymmetric 58% upper-left Lead Story with inset photo + 3-column prose, flanked by a tinted Boxed Feature, a wide Horizontal Split Anchor story below, and a vertical News Digest Rail on the right; Page 2 features a full-width Panorama Horizontal Split top story followed by staggered 54%/44% regional modules).

- **`src/engine/editor-renderer.ts` — COMPONENT 2: EDITOR (The Hands)**:
  - Deterministic execution and measurement engine. Translates the Designer's `MasterLayoutPlan` into rendered pages, measures real Telugu glyph/syllable cluster dimensions (`Noto Sans Telugu` and `Noto Serif Telugu`), and checks every element for `text_overflow`, `element_overlap`, `out_of_bounds`, `font_below_minimum`, `missing_asset`, and `caption_detached`.
  - Produces a structured `EditorDiagnosticsReport` (`status: "valid" | "layout_errors"`).

- **`src/engine/layout-feedback-loop.ts` — DESIGNER–EDITOR FEEDBACK LOOP**:
  - Iteratively passes the `EditorDiagnosticsReport` back to the Designer (`reviseMasterPlanWithDiagnostics`) whenever `status === "layout_errors"`.
  - The Designer revises only the affected elements (expanding height and reflowing downstream siblings, switching to compact headlines or short body variants, or adjusting coordinates) to produce `plan_version: v + 1` until `status === "valid"`.
  - Records every version in `planHistory` for full inspection in the UI.

- **`src/engine/layout-plan-schema.ts`**:
  - Formal JSON schema validators for `MasterLayoutPlan` and `EditorDiagnosticsReport`.

- **`src/engine/typography-and-measurement.ts`**:
  - Calibrated OpenType Telugu akshara (orthographic syllable cluster) measurement engine and `content_ref` resolver.

- **`src/engine/pdf-exporter.ts`**:
  - Renders the validated `MasterLayoutPlan` (`mm` coordinate geometry) into print-ready HTML with embedded `Noto Sans Telugu` and `Noto Serif Telugu` fonts and exports the multi-page PDF via headless Chromium (`chrome-headless-shell`), followed by an 11-point print preflight check.

---

## 2. Running & Testing

```bash
# Start full-stack Express + Vite server on port 3000
npm run dev

# Run automated unit tests (Telugu syllable metrics, binary PNG validation, Gemma/Gemini schemas, Designer+Editor feedback loop)
npm test

# Type-check and build production bundle
npm run lint
npm run build
```
