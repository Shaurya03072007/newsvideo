import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import type { LayoutModule, NewspaperEdition, PublicationSettings } from '../shared/types.ts';
import { ASSETS_DIR, buildFallbackValidPdfBuffer } from './db.ts';

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

function renderModuleHtml(mod: LayoutModule): string {
  const photoUri = resolveAssetDataUri(mod.photographUrl);
  const parasHtml = mod.bodyParagraphsTelugu
    .map(
      (p, idx) =>
        `<p class="body-para">${
          idx === 0 && !mod.isSideBrief && mod.bodyVariant !== 'continued_part2'
            ? `<strong class="dateline">${escapeHtml(mod.locationDatelineTelugu)}:</strong> `
            : ''
        }${escapeHtml(p)}</p>`
    )
    .join('');

  return `
    <article class="article-module ${mod.isLeadStory ? 'lead-module' : ''} ${mod.isSideBrief ? 'brief-module' : ''}"
      style="grid-column: span ${mod.gridColumnSpan};">
      <div class="section-strip" style="border-top: 2.5px solid ${mod.sectionColorHex};">
        <span class="section-tag" style="background:${mod.sectionColorHex};">${escapeHtml(mod.sectionLabelTelugu)}</span>
        <span class="module-meta">${escapeHtml(mod.locationDatelineTelugu)}</span>
      </div>
      <h2 class="headline" style="font-size:${mod.headlineFontSizePt}pt;">
        ${escapeHtml(mod.headlineTextTelugu)}
      </h2>
      ${
        mod.standfirstTextTelugu
          ? `<div class="standfirst">${escapeHtml(mod.standfirstTextTelugu)}</div>`
          : ''
      }
      <div class="module-content-flow ${mod.gridColumnSpan >= 2 ? `cols-${mod.gridColumnSpan}` : ''}">
        ${
          photoUri
            ? `<figure class="photo-box">
                <img src="${photoUri}" alt="${escapeHtml(mod.photographCaptionTelugu || mod.headlineTextTelugu)}" />
                ${
                  mod.photographCaptionTelugu
                    ? `<figcaption>${escapeHtml(mod.photographCaptionTelugu)}</figcaption>`
                    : ''
                }
              </figure>`
            : ''
        }
        <div class="body-text" style="font-size:${mod.bodyFontSizePt}pt; line-height:${mod.lineHeightRatio};">
          ${parasHtml}
          ${
            mod.continuationNoteTelugu
              ? `<div class="continuation-marker">${escapeHtml(mod.continuationNoteTelugu)}</div>`
              : ''
          }
        </div>
      </div>
    </article>
  `;
}

export function buildEditionPrintHtml(
  edition: NewspaperEdition,
  settings: PublicationSettings
): string {
  const showCropMarks = settings.pressPreflightProfile === 'press_cmyk_bleed';

  const pagesHtml = edition.pages
    .map((page) => {
      const mainCols = page.sideBriefs.length > 0 ? page.totalColumns - 1 : page.totalColumns;
      const modulesHtml = page.modules.map(renderModuleHtml).join('\n');
      const briefsHtml = page.sideBriefs.map(renderModuleHtml).join('\n');

      return `
        <section class="newspaper-page ${showCropMarks ? 'press-crop-marks' : ''}">
          ${
            page.pageNumber === 1
              ? `
              <header class="masthead">
                <div class="masthead-top-row">
                  <span>రిజిస్ట్రేషన్ నం: ${escapeHtml(settings.registrationNumber)}</span>
                  <span>${escapeHtml(settings.editionCityTelugu)}</span>
                  <span>సంచిక సంఖ్య: ${edition.editionNumber} · పేజీలు: ${edition.actualPageCount}</span>
                </div>
                <div class="masthead-main">
                  <div class="masthead-emblem">ప్రజా<br/>వాణి</div>
                  <div class="masthead-title-block">
                    <h1 class="masthead-title">${escapeHtml(edition.mastheadTitleTelugu)}</h1>
                    <p class="masthead-subtitle">${escapeHtml(edition.mastheadSubtitleTelugu)}</p>
                  </div>
                  <div class="masthead-weather-box">
                    <div class="weather-title">నేటి పంచాంగం · వాతావరణం</div>
                    <div class="weather-detail">తేదీ: ${escapeHtml(edition.editionDate)} · గరిష్ఠం: 32°C / కనిష్ఠం: 24°C</div>
                    <div class="weather-detail">కృష్ణా డెల్టా ప్రత్యేక సంచిక</div>
                  </div>
                </div>
                <div class="edition-strip">
                  <span><strong>మొదటి పేజీ</strong> · ప్రధాన వార్తలు</span>
                  <span>${escapeHtml(edition.editionTitleTelugu)}</span>
                  <span>www.prajavani-daily.in</span>
                </div>
              </header>
            `
              : `
              <header class="running-header">
                <span><strong>${escapeHtml(edition.mastheadTitleTelugu)}</strong> · ${escapeHtml(settings.editionCityTelugu)}</span>
                <span><strong>${page.pageNumber}వ పేజీ</strong> · ${escapeHtml(page.sectionFocusTelugu)}</span>
                <span>తేదీ: ${escapeHtml(edition.editionDate)}</span>
              </header>
            `
          }

          <div class="page-grid-container">
            <div class="main-columns-grid" style="grid-template-columns: repeat(${mainCols}, 1fr);">
              ${modulesHtml}
            </div>
            ${
              page.sideBriefs.length > 0
                ? `<aside class="side-briefs-column">
                    <div class="side-briefs-header">సంక్షిప్త వార్తలు · ప్రకటనలు</div>
                    ${briefsHtml}
                  </aside>`
                : ''
            }
          </div>

          <footer class="page-footer">
            <span>${escapeHtml(edition.mastheadTitleTelugu)} దినపత్రిక · సంపాదకులు & ప్రచురణకర్త: సెంట్రల్ న్యూస్ డెస్క్</span>
            <span>AI ఎడిటోరియల్ పైప్‌లైన్: ${escapeHtml(settings.modelAClassifierId)} + ${escapeHtml(settings.modelBStoryId)}</span>
            <span>పేజీ ${page.pageNumber} / ${edition.actualPageCount}</span>
          </footer>
        </section>
      `;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="te">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(edition.mastheadTitleTelugu)} - ${escapeHtml(edition.editionDate)}</title>
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
    .newspaper-page {
      width: ${settings.pageWidthMm}mm;
      min-height: ${settings.pageHeightMm}mm;
      padding: ${settings.marginMm}mm;
      background: #FAF8F3;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: always;
      position: relative;
    }
    .press-crop-marks {
      outline: 0.4mm dashed #78716c;
      outline-offset: -3mm;
    }
    .masthead {
      border-bottom: 2px solid #111111;
      margin-bottom: 4mm;
    }
    .masthead-top-row {
      display: flex;
      justify-content: space-between;
      font-family: 'Noto Sans Telugu', sans-serif;
      font-size: 8.5pt;
      color: #44403c;
      border-bottom: 1px solid #d6d3d1;
      padding-bottom: 1.5mm;
      margin-bottom: 2.5mm;
    }
    .masthead-main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 5mm;
      padding-bottom: 2.5mm;
    }
    .masthead-emblem {
      width: 22mm;
      height: 22mm;
      background: #9A3412;
      color: #FFFFFF;
      font-family: 'Noto Sans Telugu', sans-serif;
      font-weight: 800;
      font-size: 13pt;
      line-height: 1.15;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      border: 1.5px solid #111;
    }
    .masthead-title-block {
      text-align: center;
      flex: 1;
    }
    .masthead-title {
      font-family: 'Noto Sans Telugu', sans-serif;
      font-weight: 800;
      font-size: 42pt;
      letter-spacing: -0.02em;
      color: #9A3412;
      line-height: 1.05;
    }
    .masthead-subtitle {
      font-family: 'Noto Sans Telugu', sans-serif;
      font-size: 10pt;
      font-weight: 600;
      color: #292524;
      margin-top: 1mm;
    }
    .masthead-weather-box {
      width: 68mm;
      border: 1px solid #a8a29e;
      background: #F3EFE6;
      padding: 2.2mm;
      font-family: 'Noto Sans Telugu', sans-serif;
      font-size: 8pt;
      line-height: 1.35;
    }
    .weather-title {
      font-weight: 700;
      color: #9A3412;
      border-bottom: 1px solid #d6d3d1;
      margin-bottom: 1mm;
      padding-bottom: 0.5mm;
    }
    .edition-strip {
      display: flex;
      justify-content: space-between;
      background: #1C1917;
      color: #FAF8F3;
      font-family: 'Noto Sans Telugu', sans-serif;
      font-size: 9pt;
      padding: 1.5mm 3mm;
    }
    .running-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #1C1917;
      padding-bottom: 2mm;
      margin-bottom: 4mm;
      font-family: 'Noto Sans Telugu', sans-serif;
      font-size: 10pt;
    }
    .page-grid-container {
      display: flex;
      gap: ${settings.gutterMm}mm;
      flex: 1;
      align-items: stretch;
    }
    .main-columns-grid {
      display: grid;
      gap: ${settings.gutterMm}mm;
      flex: 1;
      align-content: start;
    }
    .side-briefs-column {
      width: 48mm;
      border-left: 1.5px solid #292524;
      padding-left: ${settings.gutterMm}mm;
      background: #F4F0E6;
      padding: 2.5mm;
      display: flex;
      flex-direction: column;
      gap: 3mm;
    }
    .side-briefs-header {
      background: #1E3A8A;
      color: #fff;
      font-family: 'Noto Sans Telugu', sans-serif;
      font-weight: 700;
      font-size: 10pt;
      padding: 1.2mm 2mm;
      text-align: center;
    }
    .article-module {
      border-bottom: 1px solid #c7c2b8;
      padding-bottom: 3mm;
      padding-right: 2mm;
      border-right: 0.5px solid #d6d1c7;
    }
    .lead-module {
      background: #FDFBF7;
      padding: 2.5mm;
      border: 1px solid #a8a29e;
    }
    .section-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5mm;
      padding-top: 1mm;
    }
    .section-tag {
      color: #fff;
      font-family: 'Noto Sans Telugu', sans-serif;
      font-size: 7.5pt;
      font-weight: 700;
      padding: 0.5mm 2mm;
    }
    .module-meta {
      font-family: 'Noto Sans Telugu', sans-serif;
      font-size: 7.5pt;
      color: #57534e;
    }
    .headline {
      font-family: 'Noto Sans Telugu', sans-serif;
      font-weight: 800;
      line-height: 1.24;
      color: #111111;
      margin-bottom: 1.8mm;
    }
    .lead-module .headline {
      color: #7C2D12;
    }
    .standfirst {
      font-family: 'Noto Sans Telugu', sans-serif;
      font-weight: 600;
      font-size: 10pt;
      color: #3f3f46;
      background: #EFECE4;
      padding: 1.2mm 2mm;
      margin-bottom: 2.2mm;
      border-left: 2.5px solid #9A3412;
    }
    .photo-box {
      margin-bottom: 2.2mm;
      background: #E7E2D8;
      border: 1px solid #a8a29e;
    }
    .photo-box img {
      width: 100%;
      max-height: 58mm;
      object-fit: cover;
      display: block;
    }
    .photo-box figcaption {
      font-family: 'Noto Sans Telugu', sans-serif;
      font-size: 8pt;
      color: #292524;
      padding: 1.2mm 2mm;
      background: #EAE5DC;
      border-top: 1px solid #d6d3d1;
    }
    .body-text {
      text-align: justify;
    }
    .cols-2 .body-text {
      column-count: 2;
      column-gap: 3.5mm;
      column-rule: 0.5px solid #d6d3d1;
    }
    .cols-3 .body-text {
      column-count: 3;
      column-gap: 3.5mm;
      column-rule: 0.5px solid #d6d3d1;
    }
    .body-para {
      margin-bottom: 1.8mm;
      text-indent: 3mm;
    }
    .body-para:first-child {
      text-indent: 0;
    }
    .dateline {
      font-family: 'Noto Sans Telugu', sans-serif;
      font-weight: 700;
    }
    .continuation-marker {
      font-family: 'Noto Sans Telugu', sans-serif;
      font-size: 8.5pt;
      font-weight: 700;
      color: #9A3412;
      text-align: right;
      margin-top: 1mm;
    }
    .page-footer {
      border-top: 1.5px solid #1C1917;
      padding-top: 1.8mm;
      margin-top: 3mm;
      display: flex;
      justify-content: space-between;
      font-family: 'Noto Sans Telugu', sans-serif;
      font-size: 8pt;
      color: #44403c;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;
}

const CHROMIUM_CANDIDATE_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ...(process.env.LOCALAPPDATA ? [path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe')] : []),
  ...(process.env.PROGRAMFILES ? [path.join(process.env.PROGRAMFILES, 'Google\\Chrome\\Application\\chrome.exe')] : []),
  '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

export function generateEditionPdfBuffer(
  edition: NewspaperEdition,
  settings: PublicationSettings,
  onLog?: (msg: string) => void
): Uint8Array {
  const html = buildEditionPrintHtml(edition, settings);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prajavani-pdf-'));
  const htmlPath = path.join(tmpDir, 'edition.html');
  const outPdfPath = path.join(tmpDir, 'edition.pdf');

  try {
    fs.writeFileSync(htmlPath, html, 'utf-8');
    const chromiumBin = CHROMIUM_CANDIDATE_PATHS.find((p) => p && fs.existsSync(p));

    if (chromiumBin) {
      if (onLog) onLog(`Rendering print-ready Telugu PDF with headless Chromium (${chromiumBin})...`);
      const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
      execFileSync(
        chromiumBin,
        [
          '--headless',
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          `--print-to-pdf=${outPdfPath}`,
          '--no-pdf-header-footer',
          fileUrl,
        ],
        { timeout: 25000, stdio: 'ignore' }
      );

      if (fs.existsSync(outPdfPath)) {
        const pdfBytes = new Uint8Array(fs.readFileSync(outPdfPath));
        if (pdfBytes.byteLength > 500) {
          if (onLog) onLog(`Chromium PDF generated (${(pdfBytes.byteLength / 1024).toFixed(1)} KB).`);
          return pdfBytes;
        }
      }
    }
  } catch (err) {
    if (onLog) {
      onLog(
        `Headless Chromium PDF pass encountered warning (${
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
