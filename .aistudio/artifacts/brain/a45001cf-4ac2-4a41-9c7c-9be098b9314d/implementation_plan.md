# Praja Vani — Designer + Editor Telugu Broadsheet Engine Repair Plan

An end-to-end architectural repair of the **Praja Vani (ప్రజా వాణి)** AI Telugu newspaper publishing engine that eliminates headline clipping, unifies the screen and print rendering pipelines around a single formal layout contract, enforces authentic 8-column **Eenadu** broadsheet composition at 85–94% page utilization, and validates every page through a real measurement and correction loop.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> All five foundational architectural and editorial specifications have been confirmed and will govern the repair without silent fallbacks or template shortcuts.

- **Confirmed Decision 1 — Physical Print & Grid Specification**: Standard Indian Broadsheet **330 × 520 mm** page size, **8-column grid**, **10 mm outer margins**, **3 mm press bleed**, and **3.5 mm inter-column gutters** (yielding a `310 × 500 mm` live printable type area with `35.6875 mm` single-column measure).
- **Confirmed Decision 2 — Reference Aesthetic & Target Utilization**: Authentic **Eenadu** daily broadsheet architecture featuring interlocking multi-column stories, `0.25 mm` vertical column hairlines, horizontal deck rules, high-contrast color anchor boxes, masthead ear panels, and a strict **85%–94% target page utilization** band.
- **Confirmed Decision 3 — Structural Composition Capabilities**: Full support for (a) top skyline teaser ribbon, calligraphic masthead with left/right ear panels, and pinned right-rail news digest column; (b) interlocking L-shaped and U-shaped multi-column text wraps around photographs and callout boxes; and (c) inset circular, dome-arch, quarter-circle wedge, tomb-arch, diamond, pentagon, hexagon, and starburst medallions with true CSS/vector text-flow exclusions.
- **Confirmed Decision 4 — Overflow & Pagination Policy**: Preserve full reporter story text on Pages 1–2 first; when a story exceeds its allocated bed on Page 1, trigger explicit **multi-page continuation** (`"మిగతా 2వ పేజీలో..."` / `"1వ పేజీ తరువాయి"`) to an inside page before ever shortening body copy, and only switch to a compact headline or tighter font size within permitted bounds when required to resolve headline clipping.
- **Confirmed Decision 5 — Measurement & PDF Verification Pipeline**: True headless Chromium DOM measurement loop paired with calibrated Unicode Telugu orthography metrics, generating a **selectable vector PDF** with embedded `Noto Sans Telugu` and `Noto Serif Telugu` fonts plus a **deterministic offline test suite** that validates saved edition manifests without calling external AI models.

---

## 1. Root-Cause Diagnosis & Core Concept

### Root Causes Identified in the Existing Implementation

1. **Silent Headline Clipping**:
   - Every positioned element in the print HTML renderer sets `overflow: hidden` on a fixed-height bounding box while the measurement heuristic divides total syllable count by average syllables per line, ignoring word-break boundaries of long Telugu compound words (`ఆయకట్టుకు`, `ప్రకాశం`, `బ్యారేజీ`) and vertical vowel/consonant conjunct extensions (*ottulu* and *matras* in `U+0C00–U+0C7F`). When a 2-line display headline wraps onto a 3rd line or requires extra vertical ascender/descender clearance, `overflow: hidden` slices the bottom line in half.
2. **Split-Brain Rendering (Screen vs. Print Mismatch)**:
   - The interactive workspace renders from a simplified card manifest (`PageLayoutManifest`) using browser auto-height flex/grid cards, while the PDF exporter renders from `MasterLayoutPlan` absolute millimeter coordinates (`x, y, width, height`). Because the two renderers do not execute the same layout tree, clipping and whitespace defects in the `MasterLayoutPlan` were invisible on the interactive canvas until opening the PDF preview.
3. **Excessive Unused Page Space (58–62% Utilization)**:
   - Story containers were assigned static height estimates without a bottom-of-page slack redistribution pass. On a `520 mm` tall broadsheet, stories terminated around `y = 310 mm`, leaving nearly `190 mm` of accidental blank paper at the bottom of Page 1 while pushing stories to Page 2 or truncating paragraphs to `.short`.
4. **Disconnected Card Modules Instead of Interlocking Broadsheet Architecture**:
   - Wrapping every article in an isolated `0.3 mm` rectangular border with uniform gaps produced a web-dashboard "cards on a background" look rather than a cohesive newspaper sheet where adjacent columns interlock across shared horizontal cutoff rules and vertical hairlines.
5. **Detached Image-to-Text Geometry**:
   - Photographs were assigned fixed `46–48 mm` heights regardless of aspect ratio or adjacent column flow, and resizing a headline during a retry pass did not dynamically shift or reflow the photograph, caption, and multi-column prose beds underneath it.
6. **Ineffective Global Pagination**:
   - Page assignment was performed greedily without evaluating total edition content volume against the `85%–94%` utilization target, resulting in unbalanced pages and unnecessary text truncation.

### What This Repair Delivers

- **Single Source of Truth Layout Engine**: Both the interactive broadsheet canvas and the headless Chromium PDF renderer execute the exact same validated `MasterLayoutPlan` geometry, typography, interlocking column beds, and geometric shape exclusions.
- **Zero-Clipping Telugu Typography Contract**: Real DOM/Chromium bounding-box measurement (`scrollHeight` vs. `clientHeight` and `scrollWidth` vs. `clientWidth`) combined with word-aware Telugu cluster wrapping ensures no headline, standfirst, caption, or body column is ever clipped.
- **Authentic 8-Column Eenadu Visual Rhythm**: Dense, interlocking broadsheet pages (`85%–94%` fill) with skyline teasers, masthead ear panels, L-shaped/U-shaped text wraps around photography, non-rectangular geometric medallions, and multi-page jump continuations.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Edition Composition & Live Designer–Editor Loop**:
   - The user selects or creates an edition and triggers the **Designer + Editor Engine**.
   - **Pass 1 (Designer Synthesis)**: `gemini-3.5-flash-lite` (coupled with `gemma-4-31b-it` classification metadata and pre-measured Telugu text profiles) synthesizes a complete 8-column `MasterLayoutPlan` (`v1`) with explicit millimeter geometry, interlocking story regions, photographic crops, and geometric cutouts.
   - **Pass 2 (Editor Measurement & Diagnostics)**: The deterministic Editor renders the plan into an offscreen/headless DOM surface at physical millimeter scale, measures every element's true rendered box, computes page utilization (`%`), checks all 12 layout invariants (clipping, overlap, orphan captions, column balance, page fill), and emits a structured `EditorDiagnosticsReport`.
   - **Pass 3 (Bounded Revision Loop)**: If any headline overflows, any element collides, or page utilization falls outside `85%–94%`, the Designer receives the exact measured millimeter deltas and permitted actions (`expand_height`, `reflow_column_span`, `use_compact_headline`, `paginate_continuation`, `redistribute_page_slack`) and produces `v2` (up to 4 bounded iterations) while preserving valid regions.
2. **Unified Broadsheet & e-Paper Inspection**:
   - Users toggle seamlessly between **Exact Physical Print Sheet Mode** (1:1 millimeter coordinate rendering matching the PDF byte-for-byte), **2-Page Spread View**, and **Coordinate & Diagnostics Overlay** (displaying exact `x, y, w, h` in `mm`, measured DOM height, and utilization metrics).
   - Clicking any story opens the **e-Paper Clipping & Live Composition Studio**, allowing the editor to inspect or override column spans, L-wrap/float geometry, and non-rectangular shapes (`circle`, `semi_circle_arch`, `quarter_circle_wedge`, `tomb_arch`, `rhombus_diamond`, `pentagon_shield`, `hexagon_gem`, `star_burst`) with immediate re-measurement and Editor validation.
3. **Cookie-Safe Vector PDF Export & Print Verification**:
   - Clicking **Download Print PDF** executes the validated `MasterLayoutPlan` through headless Chromium with embedded Unicode Telugu fonts, verifies the 12-point preflight checklist, triggers an authenticated in-memory Blob download, and opens the **Print-Ready PDF Studio** for side-by-side inspection.

### Visual Identity & Broadsheet Architecture

- **Aesthetic Direction**: Authoritative Indian regional daily broadsheet (**Eenadu / Praja Vani** editorial heritage) paired with a high-precision typographic engineering console.
- **Color Palette & Surface Tokens**:
  - **Newsprint Canvas**: Warm archival newsprint (`#FAF8F3`) for standard columns, subtle limestone tint (`#F3EFE6`) for digest rails and feature beds.
  - **Ink & Structural Rules**: Deep carbon press ink (`#111111`) for body prose and primary headlines; warm charcoal (`#1C1917`) for `0.6 mm` masthead/cutoff rules; subtle stone (`#C7C2B8`) for `0.25 mm` inter-column hairlines.
  - **Eenadu Editorial Accents**:
    - Lead & Breaking Crimson (`#991B1B` header badge, `#7F1D1D` display headline ink, `#FFF5F5` highlight tint).
    - State & Infrastructure Royal Blue (`#1E40AF` kicker, `#1E3A8A` box border, `#EFF6FF` anchor fill).
    - Agriculture & Rural Emerald (`#15803D` kicker, `#064E3B` headline, `#F0FDF4` tint).
    - Panorama & Special Feature Saffron (`#B45309` kicker, `#78350F` headline, `#FFFBEB` tint).
- **Typography & Telugu Shaping Discipline**:
  - **Display Headlines**: `Noto Sans Telugu` (Bold 700 / ExtraBold 800), `line-height: 1.32` with explicit `2.5 mm` top/bottom ascender-descender padding so vertical *ottulu* and vowel signs never clip; `text-wrap: balance` to eliminate single-word orphans.
  - **Body Prose**: `Noto Serif Telugu` (Regular 400 / SemiBold 600), `9.5pt–10.5pt` print size (`line-height: 1.52`), justified (`text-align: justify`) with word-boundary wrapping across `35.68 mm` columns.
  - **Engineering & Telemetry Numerals**: `JetBrains Mono` (`tabular-nums`) strictly for millimeter coordinates, preflight metrics, and version diffs.
- **Top Bar Contract**:
  - Single-row, three-zone header separated by `gap-8`: Zone 1 single-line wordmark (`ప్రజా వాణి · Praja Vani Press`), Zone 2 five single-line navigation links (`Overview`, `Submissions`, `AI Pipeline`, `Editions`, `Broadsheet Preview`), and Zone 3 single primary CTA (`Submit Telugu Story`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Unified Coordinate-Driven Rendering (`MasterLayoutPlan` as Single Source of Truth)**
  - *Chosen Approach*: Drive both the interactive broadsheet page sheet and the PDF print renderer directly from the validated `MasterLayoutPlan` (`330 × 520 mm`, 8 columns, `10 mm` margins, `3 mm` bleed). `PageLayoutManifest` becomes a synchronized view projection derived strictly from the final `MasterLayoutPlan` coordinates.
  - *Why*: Eliminates the discrepancy where the interactive preview looked acceptable while the generated PDF had clipped headlines and empty lower pages.
  - *Alternatives Considered*: Maintaining separate CSS Grid and absolute-coordinate renderers — rejected because dual layout engines cannot guarantee geometric parity.

- **Decision 2 — Word-Aware Telugu Cluster Measurement + Headless Chromium DOM Verification**
  - *Chosen Approach*: Upgrade the Telugu measurement engine to tokenize paragraphs into actual whitespace-delimited words and orthographic *akshara* clusters (accounting for consonant conjunct width expansion and vertical *ottu* clearance), and verify the composed page inside headless Chromium to read exact `scrollHeight`/`clientHeight` boxes before finalizing the plan.
  - *Why*: Character-count or naive syllable division underestimates line wraps when long Telugu compound words cannot break mid-word, causing silent clipping.
  - *Alternatives Considered*: Pure character-count heuristics — explicitly prohibited and inaccurate for Indic scripts.

- **Decision 3 — Interlocking 8-Column Packing & Deliberate Slack Redistribution (`85%–94%` Utilization)**
  - *Chosen Approach*: The Designer partitions each `310 × 500 mm` live page area into interlocking editorial zones:
    1. **Top Skyline & Masthead Zone (`76 mm` on Page 1; `14 mm` running header on inside pages)**.
    2. **Primary Lead & Panorama Zone (Columns 1–7, interlocking 5-column lead with 2-column companion or L-shaped wrap)**.
    3. **Mid-Page Multi-Column Fold & Geometric Medallion Zone (2-col, 3-col, and 4-col stories with circular/arch/polygon `shape-outside` text wraps)**.
    4. **Lower Anchor & Continuation Zone + Pinned Column 8 Digest Rail (`సంక్షిప్త వార్తలు · ఈనాటి గణాంకాలు`)**.
    After initial placement, a deterministic vertical slack-redistribution solver expands body column beds, promotes continuation segments, or scales photographic frames within their permitted aspect bounds so every page achieves `85%–94%` utilization with zero dead voids.
  - *Why*: Guarantees dense, authentic Indian broadsheet pages without inventing fake text or shrinking fonts below `9.5pt`.

- **Decision 4 — Multi-Page Continuation Before Copy Shortening**
  - *Chosen Approach*: When full story bodies exceed Page 1 capacity, the Designer splits the overflow story cleanly at a paragraph boundary into a Page 1 lead segment (`content_ref: "art_id.body.part1"`, ending with `"మిగతా 2వ పేజీలో..."`) and a linked Page 2 continuation module (`content_ref: "art_id.body.part2"`, prefixed with `"1వ పేజీ తరువాయి"`), preserving 100% of the reporter's text.
  - *Why*: Respects journalistic completeness and matches real Eenadu front-page jump conventions.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Feedback Loop Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                   REPORTER SUBMISSIONS & EDITORIAL QUEUE (SQLite)                   │
│   Telugu Stories + Validated Photo Assets + Gemma 4 31B Classification Metadata     │
└──────────────────────────────────────────┬──────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│         PRE-LAYOUT TELUGU TYPOGRAPHY & ASSET PROFILER (Word + Akshara Metrics)      │
│  Computes word-boundary line wraps, vertical ottu clearance, & photo aspect ratios  │
│  across 1..8 column spans (35.7mm .. 310mm) in Noto Sans/Serif Telugu               │
└──────────────────────────────────────────┬──────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                  COMPONENT A: DESIGNER — THE MIND (Gemini 3.5 Flash-Lite)           │
│  Synthesizes / Revises Formal MasterLayoutPlan (330×520mm, 8 Cols, 10mm Margin):    │
│  • Skyline Teasers, Calligraphic Masthead, Left/Right Ear Panels, Col-8 Digest Rail │
│  • Interlocking L-Wraps, Multi-Col Beds, & 9 Geometric Medallion Cutouts            │
│  • Full-Text Priority + Explicit Page 1 → Page 2 Story Jump Continuations           │
└─────────────────────┬───────────────────────────────────────────────────────────────┘
                      │  MasterLayoutPlan (v1..vN)
                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│              COMPONENT B: EDITOR — DETERMINISTIC EXECUTION & VALIDATION             │
│  1. Schema & Reference Gate: Validates IDs, assets, fonts, 8-col grid & bleed bounds│
│  2. Real Measurement Pass: Measures rendered Telugu DOM boxes & line wraps          │
│  3. Invariant Checker: Detects 0.1mm headline/body clipping, AABB collisions,       │
│     detached captions, duplicate stories, & checks 85%–94% Page Utilization target  │
└─────────────────────┬───────────────────────────────────────────┬───────────────────┘
                      │ Issues Found (Retry < MaxIterations)      │ Status === 'valid'
                      ▼                                           ▼
┌─────────────────────────────────────────────┐ ┌─────────────────────────────────────┐
│       STRUCTURED DIAGNOSTICS REPORT         │ │   UNIFIED BROADSHEET & PDF OUTPUT   │
│  • element_id, issue_type, page_number      │ │  • 1:1 Interactive Broadsheet Canvas│
│  • required_height_mm vs allocated_height_mm│ │  • Headless Chromium Vector PDF     │
│  • page_utilization_ratio (target 0.85–0.94)│ │    (Selectable Telugu + 3mm Bleed)  │
│  • allowed_actions[] → Sent back to Designer│ │  • Offline Saved-Manifest Test Suite│
└─────────────────────────────────────────────┘ └─────────────────────────────────────┘
```

### Formal Layout Contract (`MasterLayoutPlan` Schema Enhancements)

Every page and element in `MasterLayoutPlan` enforces a strict contract:

- **Page-Level Contract (`MasterLayoutPagePlan`)**:
  - Physical dimensions: `width: 330`, `height: 520`, `bleed_mm: 3`, `margin_top_mm: 10`, `margin_bottom_mm: 10`, `margin_left_mm: 10`, `margin_right_mm: 10`.
  - Grid specification: `columns: 8`, `gutter_mm: 3.5`, `live_width_mm: 310`, `live_height_mm: 500`, `column_width_mm: 35.6875`.
  - Density metrics: `target_utilization_min: 0.85`, `target_utilization_max: 0.94`, `planned_utilization_ratio: number`.
- **Element-Level Contract (`PlanElement`)**:
  - Identity & provenance: `element_id`, `type` (`skyline_strip`, `ear_panel`, `masthead`, `edition_strip`, `running_header`, `article_container`, `section_kicker`, `headline`, `standfirst`, `body_text`, `photograph`, `caption`, `callout_box`, `shaped_medallion`, `continuation_link`, `divider`, `footer`), `article_id`, `asset_id`, `parent_container_id`.
  - Geometry & constraints: `geometry: { x, y, width, height }`, `grid_span: { start_col: 1..8, col_span: 1..8 }`, `min_height_mm`, `max_height_mm`, `z_index`, `reading_order`.
  - Typography & shaping: `font_family`, `font_size_pt` (`min_font_size_pt: 9.5` for body, `13` for headlines), `font_weight`, `line_height`, `text_align`, `preserve_full_text`.
  - Image & Geometric Contour: `image_fit: { fitting_mode, focal_point_x, focal_point_y, aspect_ratio, caption_element_id }`, `geometric_shape: GeometricShapeSpec`, `wrap_exclusions: Array<{ x, y, width, height, shape_type }>`.
  - Permitted repair actions: `allowed_actions: AllowedAdjustmentAction[]` (`increase_height`, `increase_width`, `use_compact_headline`, `reduce_font_size_within_bounds`, `reflow_columns`, `move_to_next_page`, `paginate_continuation`, `adjust_image_aspect`, `expand_to_fill_slack`).

### Interactive Component & State Mapping

1. **Broadsheet Canvas (`NewspaperBroadsheetView.tsx`)**:
   - Adds a **Render Fidelity Switcher** (`Master Plan 1:1 Print Sheet` vs. `Interactive Responsive Grid` vs. `2-Page Spread View`) defaulting to a high-density 8-column broadsheet sheet where every module, hairline, L-shaped wrap, ear panel, skyline ribbon, and geometric cutout reflects the exact validated `MasterLayoutPlan` state.
   - Displays real-time **Page Utilization Telemetry** (`Page 1 Fill: 91.4% · Target: 85–94% · Zero Clipping`) and lets the user inspect every Designer–Editor iteration (`v1 → v2 → v3`) with highlighted resolved diagnostics.
2. **Designer + Editor Feedback Loop & Saved-Manifest Replay**:
   - Exposes a deterministic `runOfflineMasterPlanPipeline(savedManifest)` function and API route (`POST /api/editions/:id/validate-manifest`) that executes the full Designer–Editor measurement, diagnostic, and repair cycle using saved edition manifests without calling external AI endpoints.
3. **Automated Technical & Visual Test Suite**:
   - Comprehensive `node:test` suites covering all 16 required edge cases: long compound Telugu headlines, short headlines, long multi-page bodies with jump continuations, missing photographs, varied image aspect ratios, multi-photo stories, Telugu numerals/punctuation/combining marks, narrow `35.7 mm` single columns, full-width 8-column banners, overflow recovery, duplicate story suppression, missing asset rejection, invalid coordinate rejection, multi-page balance, sparse-edition handling, and saved-manifest offline replay.
