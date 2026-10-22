import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import type {
  Article,
  MasterLayoutPagePlan,
  MasterLayoutPlan,
  NewspaperEdition,
  PlanElement,
  PublicationSettings,
} from '../shared/types.ts';
import { ASSETS_DIR, buildFallbackValidPdfBuffer, listArticles } from '../server/db.ts';
import { resolveElementTeluguText } from './typography-and-measurement.ts';
import { buildGeometricShapeSvgBorder } from './geometric-shapes.ts';

function resolveAssetDataUri(publicUrl: string | null): string | null {
  if (!publicUrl) return null;
  const filename = path.basename(publicUrl);
  const fullPath = path.join(ASSETS_DIR, filename);
  if (fs.existsSync(fullPath)) {
    const bytes = fs.readFileSync(fullPath);
    const ext = path.extname(filename).toLowerCase();
    const mime =
      ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.webp'
        ? 'image/webp'
        : 'image/png';
    return `data:${mime};base64,${bytes.toString('base64')}`;
  }
  return publicUrl;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPlanElementHtml(
  el: PlanElement,
  articlesMap: Map<string, Article>,
  edition: NewspaperEdition,
  settings: PublicationSettings
): string {
  const { x, y, width, height } = el.geometry;
  const baseStyle = `position:absolute; left:${x}mm; top:${y}mm; width:${width}mm; height:${height}mm; z-index:${el.z_index}; overflow:hidden;`;

  if (el.type === 'masthead') {
    return `
      <header class="plan-masthead" style="${baseStyle} background:${el.style?.background_color_hex || '#FAF8F3'}; border-bottom:${el.style?.border_bottom_width_mm || 0.6}mm solid ${el.style?.border_color_hex || '#1C1917'};">
        <div class="masthead-top-meta">
          <span>రిజిస్ట్రేషన్ నం: ${escapeHtml(settings.registrationNumber)}</span>
          <span>${escapeHtml(settings.editionCityTelugu)}</span>
          <span>సంచిక #${edition.editionNumber} · Designer+Editor Engine (v${edition.masterPlan?.plan_version || 1})</span>
        </div>
        <div class="masthead-main-row">
          <div class="masthead-emblem">ప్రజా<br/>వాణి</div>
          <div class="masthead-center">
            <h1 class="masthead-title">${escapeHtml(edition.mastheadTitleTelugu)}</h1>
            <p class="masthead-subtitle">${escapeHtml(edition.mastheadSubtitleTelugu)}</p>
          </div>
          <div class="masthead-weather">
            <div class="weather-head">నేటి పంచాంగం · వాతావరణం</div>
            <div>తేదీ: ${escapeHtml(edition.editionDate)} · 32°C / 24°C</div>
            <div>కృష్ణా డెల్టా ప్రత్యేక సంచిక</div>
          </div>
        </div>
      </header>
    `;
  }

  if (el.type === 'edition_strip' || el.type === 'running_header' || el.type === 'callout_box' || el.type === 'footer') {
    const resolved = resolveElementTeluguText(el, articlesMap);
    const bg = el.style?.background_color_hex || 'transparent';
    const color = el.typography?.color_hex || '#111111';
    const fontPt = el.typography?.font_size_pt || 9.5;
    const weight = el.typography?.font_weight || 700;
    const align = el.typography?.alignment || 'left';
    const pad = el.style?.padding_mm ?? 1.5;
    const borderTop = el.style?.border_top_width_mm
      ? `border-top:${el.style.border_top_width_mm}mm solid ${el.style.border_color_hex || '#1C1917'};`
      : '';
    const borderBottom = el.style?.border_bottom_width_mm
      ? `border-bottom:${el.style.border_bottom_width_mm}mm solid ${el.style.border_color_hex || '#1C1917'};`
      : '';

    return `
      <div class="plan-bar plan-${el.type}" style="${baseStyle} background:${bg}; color:${color}; font-size:${fontPt}pt; font-weight:${weight}; text-align:${align}; padding:${pad}mm; ${borderTop} ${borderBottom} display:flex; align-items:center; justify-content:${align === 'center' ? 'center' : 'space-between'};">
        <span>${escapeHtml(resolved.text)}</span>
      </div>
    `;
  }

  if (el.type === 'article_container') {
    const bg = el.style?.background_color_hex || '#FAF8F3';
    const bw = el.style?.border_width_mm
      ? `border:${el.style.border_width_mm}mm solid ${el.style.border_color_hex || '#C7C2B8'};`
      : '';
    const bb = el.style?.border_bottom_width_mm
      ? `border-bottom:${el.style.border_bottom_width_mm}mm solid ${el.style.border_color_hex || '#C7C2B8'};`
      : '';
    return `<div class="plan-container" style="${baseStyle} background:${bg}; ${bw} ${bb}"></div>`;
  }

  if (el.type === 'section_kicker') {
    const resolved = resolveElementTeluguText(el, articlesMap);
    const bg = el.style?.background_color_hex || '#9A3412';
    return `
      <div class="plan-kicker" style="${baseStyle} overflow:visible; border-top: 0.6mm solid ${bg}; display:flex; align-items:center;">
        <span style="background:${bg}; color:#FFFFFF; font-family:'Noto Sans Telugu',sans-serif; font-size:${el.typography?.font_size_pt || 8.5}pt; font-weight:700; padding:0.4mm 2mm;">
          ${escapeHtml(resolved.text)}
        </span>
      </div>
    `;
  }

  if (el.type === 'headline') {
    const resolved = resolveElementTeluguText(el, articlesMap);
    const rawPt = el.typography?.font_size_pt || 16;
    // Scale font slightly if a 2-line lead headline is inside a compact <18mm box
    const effectivePt = rawPt >= 20 && height < 18 ? 18.5 : rawPt;
    const effectiveLh = rawPt >= 20 && height < 18 ? 1.15 : (el.typography?.line_height || 1.22);
    return `
      <h2 class="plan-headline" style="${baseStyle} overflow:visible; font-family:'Noto Sans Telugu',sans-serif; font-size:${effectivePt}pt; font-weight:${el.typography?.font_weight || 800}; line-height:${effectiveLh}; color:${el.typography?.color_hex || '#111111'};">
        ${escapeHtml(resolved.text)}
      </h2>
    `;
  }

  if (el.type === 'standfirst') {
    const resolved = resolveElementTeluguText(el, articlesMap);
    return `
      <div class="plan-standfirst" style="${baseStyle} overflow:visible; background:${el.style?.background_color_hex || '#EFECE4'}; border-left:${el.style?.border_left_width_mm || 0.8}mm solid ${el.style?.border_color_hex || '#9A3412'}; padding:${el.style?.padding_mm || 1.2}mm; font-family:'Noto Sans Telugu',sans-serif; font-size:${el.typography?.font_size_pt || 10}pt; font-weight:600; line-height:${el.typography?.line_height || 1.32}; color:${el.typography?.color_hex || '#292524'};">
        ${escapeHtml(resolved.text)}
      </div>
    `;
  }

  if (el.type === 'photograph') {
    const art = el.article_id ? articlesMap.get(el.article_id) : undefined;
    const asset =
      art?.assets?.find((a) => a.id === el.asset_id) ||
      art?.assets?.find((a) => a.id === art.primaryAssetId) ||
      art?.assets?.[0];
    const dataUri = resolveAssetDataUri(asset?.publicUrl || null);
    if (!dataUri) return '';

    const fit = el.image_fit?.fitting_mode || 'cover';
    const fx = Math.round((el.image_fit?.focal_point_x ?? 0.5) * 100);
    const fy = Math.round((el.image_fit?.focal_point_y ?? 0.5) * 100);
    const geoShape = el.style?.geometric_shape;
    const clipStyle =
      geoShape && geoShape.clip_path_css && geoShape.clip_path_css !== 'none'
        ? `clip-path:${geoShape.clip_path_css}; -webkit-clip-path:${geoShape.clip_path_css};`
        : '';
    const svgBorder =
      geoShape && geoShape.shape_type !== 'rectangle'
        ? buildGeometricShapeSvgBorder(geoShape.shape_type, '#991B1B', 2.2)
        : '';
    const shapeBadge =
      geoShape && geoShape.badge_value_telugu
        ? `<div style="position:absolute;bottom:2mm;right:2mm;background:rgba(24,24,27,0.9);color:#FDE68A;font-family:'Noto Sans Telugu',sans-serif;font-size:7.5pt;font-weight:700;padding:0.6mm 1.8mm;border:0.25mm solid #F59E0B;z-index:15;">${escapeHtml(geoShape.badge_title_telugu || '')}: ${escapeHtml(geoShape.badge_value_telugu)}</div>`
        : '';

    return `
      <figure class="plan-photo" style="${baseStyle} ${clipStyle} border:${
      geoShape && geoShape.shape_type !== 'rectangle' ? '0' : `${el.style?.border_width_mm || 0.3}mm solid ${el.style?.border_color_hex || '#A8A29E'}`
    }; background:#E7E2D8;">
        <img src="${dataUri}" alt="${escapeHtml(asset?.captionTelugu || '')}" style="width:100%; height:100%; object-fit:${fit}; object-position:${fx}% ${fy}%; display:block;" />
        ${svgBorder}
        ${shapeBadge}
      </figure>
    `;
  }

  if (el.type === 'caption') {
    const resolved = resolveElementTeluguText(el, articlesMap);
    return `
      <figcaption class="plan-caption" style="${baseStyle} background:${el.style?.background_color_hex || '#EAE5DC'}; padding:${el.style?.padding_mm || 1}mm; font-family:'Noto Sans Telugu',sans-serif; font-size:${el.typography?.font_size_pt || 8.5}pt; font-weight:500; line-height:${el.typography?.line_height || 1.3}; color:#292524; border-bottom:0.3mm solid #D6D3D1;">
        ${escapeHtml(resolved.text)}
      </figcaption>
    `;
  }

  if (el.type === 'body_text') {
    const resolved = resolveElementTeluguText(el, articlesMap);
    const art = el.article_id ? articlesMap.get(el.article_id) : undefined;
    const cols = el.text_flow?.columns || 1;
    const gapMm = el.text_flow?.column_gap_mm ?? 3.5;
    const ruleHex = el.text_flow?.column_rule_color_hex || '#D6D1C7';

    const parasHtml = resolved.paragraphs
      .map((p, idx) => {
        const trimmed = p.trim();
        const locPrefix = art?.location ? `${art.location}:` : '';
        const cleanBody =
          idx === 0 && locPrefix && trimmed.startsWith(locPrefix)
            ? trimmed.slice(locPrefix.length).trim()
            : trimmed;
        return `<p class="plan-body-para">${
          idx === 0 && art?.location
            ? `<strong class="dateline">${escapeHtml(art.location)}:</strong> `
            : ''
        }${escapeHtml(cleanBody)}</p>`;
      })
      .join('');

    return `
      <div class="plan-body" style="${baseStyle} font-family:'Noto Serif Telugu',serif; font-size:${el.typography?.font_size_pt || 9.8}pt; line-height:${el.typography?.line_height || 1.48}; text-align:justify; color:#18181B; column-count:${cols}; column-gap:${gapMm}mm; column-rule:0.3mm solid ${ruleHex};">
        ${parasHtml}
      </div>
    `;
  }

  return '';
}

/**
 * Builds the print-ready HTML directly from the validated `MasterLayoutPlan` coordinates (`mm`).
 */
export function buildMasterPlanPrintHtml(
  edition: NewspaperEdition,
  plan: MasterLayoutPlan,
  articles: Article[],
  settings: PublicationSettings
): string {
  const articlesMap = new Map(articles.map((a) => [a.id, a]));
  const showCropMarks = settings.pressPreflightProfile === 'press_cmyk_bleed';

  const pagesHtml = plan.pages
    .map((page: MasterLayoutPagePlan) => {
      const sortedElements = [...page.elements].sort((a, b) => a.z_index - b.z_index);
      const elementsHtml = sortedElements
        .map((el) => renderPlanElementHtml(el, articlesMap, edition, settings))
        .join('\n');

      return `
        <section class="newspaper-page ${showCropMarks ? 'press-crop-marks' : ''}" style="width:${page.width}mm; height:${page.height}mm; position:relative; page-break-after:always; background:#FAF8F3; overflow:hidden;">
          ${elementsHtml}
        </section>
      `;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="te">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(edition.mastheadTitleTelugu)} - ${escapeHtml(edition.editionDate)} (Plan v${plan.plan_version})</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;600;700;800&family=Noto+Serif+Telugu:wght@400;600;700;800&display=swap" rel="stylesheet" />
  <style>
    @page {
      size: ${settings.pageWidthMm}mm ${settings.pageHeightMm}mm;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Noto Serif Telugu', 'Noto Sans Telugu', serif;
      background: #FAF8F3;
      color: #111111;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .press-crop-marks {
      outline: 0.4mm dashed #78716c;
      outline-offset: -3mm;
    }
    .masthead-top-meta {
      display: flex;
      justify-content: space-between;
      font-family: 'Noto Sans Telugu', sans-serif;
      font-size: 8pt;
      color: #44403C;
      border-bottom: 0.3mm solid #D6D3D1;
      padding-bottom: 1mm;
      margin-bottom: 2mm;
    }
    .masthead-main-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4mm;
    }
    .masthead-emblem {
      width: 20mm;
      height: 20mm;
      background: #9A3412;
      color: #FFFFFF;
      font-family: 'Noto Sans Telugu', sans-serif;
      font-weight: 800;
      font-size: 12pt;
      line-height: 1.15;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      border: 0.4mm solid #111111;
    }
    .masthead-center {
      text-align: center;
      flex: 1;
    }
    .masthead-title {
      font-family: 'Noto Sans Telugu', sans-serif;
      font-weight: 800;
      font-size: 38pt;
      color: #9A3412;
      line-height: 1.02;
    }
    .masthead-subtitle {
      font-family: 'Noto Sans Telugu', sans-serif;
      font-size: 9.5pt;
      font-weight: 600;
      color: #292524;
      margin-top: 0.8mm;
    }
    .masthead-weather {
      width: 64mm;
      border: 0.3mm solid #A8A29E;
      background: #F3EFE6;
      padding: 1.8mm;
      font-family: 'Noto Sans Telugu', sans-serif;
      font-size: 7.8pt;
      line-height: 1.3;
    }
    .weather-head {
      font-weight: 700;
      color: #9A3412;
      border-bottom: 0.25mm solid #D6D3D1;
      margin-bottom: 0.8mm;
    }
    .plan-body-para {
      margin-bottom: 1.5mm;
      text-indent: 2.5mm;
    }
    .plan-body-para:first-child {
      text-indent: 0;
    }
    .dateline {
      font-family: 'Noto Sans Telugu', sans-serif;
      font-weight: 700;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;
}

function resolveChromiumBinaryPath(): string | undefined {
  const staticCandidates = [
    '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell',
    '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ];
  for (const p of staticCandidates) {
    if (fs.existsSync(p)) return p;
  }
  try {
    if (fs.existsSync('/ms-playwright')) {
      const entries = fs.readdirSync('/ms-playwright');
      for (const dir of entries) {
        const candidate1 = path.join(
          '/ms-playwright',
          dir,
          'chrome-headless-shell-linux64',
          'chrome-headless-shell'
        );
        if (fs.existsSync(candidate1)) return candidate1;
        const candidate2 = path.join('/ms-playwright', dir, 'chrome-linux', 'chrome');
        if (fs.existsSync(candidate2)) return candidate2;
      }
    }
  } catch {
    // ignore fs scan errors
  }
  return undefined;
}

/**
 * Exports the validated MasterLayoutPlan into a print-ready PDF buffer via headless Chromium.
 */
export function exportMasterPlanToPdfBuffer(
  edition: NewspaperEdition,
  settings: PublicationSettings,
  articles?: Article[],
  onLog?: (msg: string) => void
): Uint8Array {
  const allArticles = articles || listArticles();
  const plan = edition.masterPlan;
  if (!plan) {
    return buildFallbackValidPdfBuffer(edition);
  }

  const html = buildMasterPlanPrintHtml(edition, plan, allArticles, settings);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prajavani-masterplan-pdf-'));
  const htmlPath = path.join(tmpDir, 'edition.html');
  const outPdfPath = path.join(tmpDir, 'edition.pdf');

  try {
    fs.writeFileSync(htmlPath, html, 'utf-8');
    const chromiumBin = resolveChromiumBinaryPath();

    if (chromiumBin) {
      if (onLog) {
        onLog(
          `Editor PDF Exporter: Rendering validated MasterLayoutPlan v${plan.plan_version} with headless Chromium (${chromiumBin})...`
        );
      }
      execFileSync(
        chromiumBin,
        [
          '--headless',
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          `--print-to-pdf=${outPdfPath}`,
          '--no-pdf-header-footer',
          `file://${htmlPath}`,
        ],
        { timeout: 25000, stdio: 'ignore' }
      );

      if (fs.existsSync(outPdfPath)) {
        const pdfBytes = new Uint8Array(fs.readFileSync(outPdfPath));
        if (pdfBytes.byteLength > 500) {
          if (onLog) {
            onLog(
              `Editor PDF Exporter: Generated print-ready Telugu PDF (${(pdfBytes.byteLength / 1024).toFixed(1)} KB).`
            );
          }
          return pdfBytes;
        }
      }
    }
  } catch (err) {
    if (onLog) {
      onLog(
        `Headless Chromium PDF pass warning (${
          err instanceof Error ? err.message : String(err)
        }); using deterministic vector PDF writer.`
      );
    }
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  }

  return buildFallbackValidPdfBuffer(edition);
}
