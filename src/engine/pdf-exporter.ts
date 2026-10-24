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
import { getAutonomousBureauFallbackStories } from './designer-service.ts';

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

function escapeHtml(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
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

  if (el.type === 'edition_strip' || el.type === 'running_header' || el.type === 'footer') {
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

  if (el.type === 'callout_box') {
    const resolved = resolveElementTeluguText(el, articlesMap);
    const bg = el.style?.background_color_hex || '#FAF8F3';
    const border = el.style?.border_width_mm
      ? `border:${el.style.border_width_mm}mm solid ${el.style.border_color_hex || '#D97706'};`
      : '';
    const pad = el.style?.padding_mm ?? 1.5;

    // 1. Infographic Data Box: "ఈనాటి ముఖ్య గణాంకాలు"
    if (el.content_ref === 'edition.infographic' || el.element_id.includes('infographic')) {
      return `
        <div class="plan-infographic-card" style="${baseStyle} ${border} background:#FFFBEB; padding:${pad}mm; font-family:'Noto Sans Telugu',sans-serif; box-sizing:border-box;">
          <div style="background:#B45309; color:#FFFFFF; font-size:8.5pt; font-weight:800; text-align:center; padding:1mm 1.5mm; margin-bottom:1.5mm; letter-spacing:0.2mm;">
            ఈనాటి ముఖ్య గణాంకాలు
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:7.8pt; line-height:1.25; color:#1C1917;">
            <tr style="border-bottom:0.2mm solid #FDE68A;">
              <td style="padding:1mm 0.5mm; font-weight:600;">కృష్ణా ఆయకట్టు:</td>
              <td style="padding:1mm 0.5mm; text-align:right; font-weight:800; color:#991B1B;">13.08 లక్షల ఎక.</td>
            </tr>
            <tr style="border-bottom:0.2mm solid #FDE68A;">
              <td style="padding:1mm 0.5mm; font-weight:600;">ధాన్యం కేంద్రాలు:</td>
              <td style="padding:1mm 0.5mm; text-align:right; font-weight:800; color:#065F46;">142 కేంద్రాలు</td>
            </tr>
            <tr style="border-bottom:0.2mm solid #FDE68A;">
              <td style="padding:1mm 0.5mm; font-weight:600;">కొత్త ఇ-బస్సులు:</td>
              <td style="padding:1mm 0.5mm; text-align:right; font-weight:800; color:#1E40AF;">120 సర్వీసులు</td>
            </tr>
            <tr style="border-bottom:0.2mm solid #FDE68A;">
              <td style="padding:1mm 0.5mm; font-weight:600;">ఐటీ పెట్టుబడులు:</td>
              <td style="padding:1mm 0.5mm; text-align:right; font-weight:800; color:#78350F;">₹1,850 కోట్లు</td>
            </tr>
            <tr>
              <td style="padding:1mm 0.5mm; font-weight:600;">ప్రాథమిక ఆరోగ్య కేం.:</td>
              <td style="padding:1mm 0.5mm; text-align:right; font-weight:800; color:#065F46;">24 గంటలు</td>
            </tr>
          </table>
        </div>
      `;
    }

    // 2. Market Rates Box: "మార్కెట్ సమాచారం"
    if (el.content_ref === 'edition.market' || el.element_id.includes('market')) {
      return `
        <div class="plan-market-card" style="${baseStyle} ${border} background:#F0FDF4; padding:${pad}mm; font-family:'Noto Sans Telugu',sans-serif; box-sizing:border-box;">
          <div style="background:#065F46; color:#FFFFFF; font-size:8.5pt; font-weight:800; text-align:center; padding:1mm 1.5mm; margin-bottom:1.5mm;">
            మార్కెట్ సమాచారం · ధరలు
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:7.5pt; line-height:1.2; color:#14532D;">
            <tr style="border-bottom:0.2mm solid #BBF7D0;">
              <td style="padding:0.8mm 0.5mm; font-weight:600;">24K బంగారం (10గ్రా):</td>
              <td style="padding:0.8mm 0.5mm; text-align:right; font-weight:800; color:#991B1B;">₹76,450</td>
            </tr>
            <tr style="border-bottom:0.2mm solid #BBF7D0;">
              <td style="padding:0.8mm 0.5mm; font-weight:600;">22K బంగారం (10గ్రా):</td>
              <td style="padding:0.8mm 0.5mm; text-align:right; font-weight:800; color:#991B1B;">₹70,080</td>
            </tr>
            <tr style="border-bottom:0.2mm solid #BBF7D0;">
              <td style="padding:0.8mm 0.5mm; font-weight:600;">వెండి (కేజీ):</td>
              <td style="padding:0.8mm 0.5mm; text-align:right; font-weight:800; color:#1E3A8A;">₹91,200</td>
            </tr>
            <tr style="border-bottom:0.2mm solid #BBF7D0;">
              <td style="padding:0.8mm 0.5mm; font-weight:600;">గ్రేడ్-ఎ ధాన్యం:</td>
              <td style="padding:0.8mm 0.5mm; text-align:right; font-weight:800; color:#065F46;">₹2,320</td>
            </tr>
            <tr style="border-bottom:0.2mm solid #BBF7D0;">
              <td style="padding:0.8mm 0.5mm; font-weight:600;">పత్తి (క్వింటాల్):</td>
              <td style="padding:0.8mm 0.5mm; text-align:right; font-weight:800; color:#78350F;">₹7,520</td>
            </tr>
            <tr>
              <td style="padding:0.8mm 0.5mm; font-weight:600;">పెట్రోల్ / డీజిల్:</td>
              <td style="padding:0.8mm 0.5mm; text-align:right; font-weight:800; color:#111111;">₹109.8 / ₹97.6</td>
            </tr>
          </table>
        </div>
      `;
    }

    // 3. Reader Notice & Editorial Desk Box
    if (el.content_ref === 'edition.notice' || el.element_id.includes('notice')) {
      return `
        <div class="plan-notice-card" style="${baseStyle} ${border} background:#FAF8F3; padding:${pad}mm; font-family:'Noto Sans Telugu',sans-serif; box-sizing:border-box; display:flex; flex-direction:column; justify-content:space-between;">
          <div style="background:#881337; color:#FFFFFF; font-size:8.5pt; font-weight:800; text-align:center; padding:1mm 1.5mm; margin-bottom:1.5mm;">
            పాఠకుల వేదిక &amp; సంపాదకీయం
          </div>
          <div style="font-size:7.5pt; line-height:1.35; color:#292524;">
            <div><strong>RNI:</strong> APENG/2028/88412</div>
            <div><strong>ముద్రణ:</strong> విజయవాడ బ్యూరో</div>
            <div><strong>హెల్ప్‌లైన్:</strong> 1800-425-9988</div>
            <div style="margin-top:1.5mm; font-size:7.2pt; color:#57534E; border-top:0.2mm solid #D6D3D1; padding-top:1mm;">
              ఈ సంచికలోని వార్తలు ఏఐ ధృవీకరణ నివేదిక ఆధారంగా నిష్పాక్షికంగా ముద్రించబడ్డాయి.
            </div>
          </div>
        </div>
      `;
    }

    // 4. State News Roundup Banner (Columns 1-5 Bottom Anchor)
    if (el.content_ref === 'edition.roundup' || el.element_id.includes('roundup')) {
      return `
        <div class="plan-roundup-banner" style="${baseStyle} ${border} background:#FFFDF7; padding:${pad}mm; font-family:'Noto Sans Telugu',sans-serif; box-sizing:border-box;">
          <div style="background:#991B1B; color:#FFFFFF; font-size:8.8pt; font-weight:800; padding:1mm 2.5mm; display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5mm;">
            <span>రాష్ట్ర వార్తా సంగ్రహం · ప్రాంతీయ అభివృద్ధి విశేషాలు</span>
            <span style="font-size:7.5pt; font-weight:600; color:#FDE68A;">ప్రత్యేక రౌండప్</span>
          </div>
          <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:2.5mm; font-size:7.8pt; line-height:1.3; color:#1C1917;">
            <div style="border-right:0.25mm solid #E5E7EB; padding-right:2mm;">
              <span style="background:#991B1B; color:#FFFFFF; font-size:6.8pt; font-weight:700; padding:0.2mm 1.2mm; border-radius:0.5mm;">తిరుపతి</span>
              <p style="margin:1mm 0 0; font-weight:600; color:#111111;">ప్రాథమిక ఆరోగ్య కేంద్రాల్లో 24 గంటల అత్యవసర వైద్య సేవలు ప్రారంభం.</p>
            </div>
            <div style="border-right:0.25mm solid #E5E7EB; padding-right:2mm;">
              <span style="background:#065F46; color:#FFFFFF; font-size:6.8pt; font-weight:700; padding:0.2mm 1.2mm; border-radius:0.5mm;">వరంగల్</span>
              <p style="margin:1mm 0 0; font-weight:600; color:#111111;">రూ. 380 కోట్ల రింగ్ రోడ్డు వంతెన పనులు తుది దశకు చేరాయి.</p>
            </div>
            <div style="border-right:0.25mm solid #E5E7EB; padding-right:2mm;">
              <span style="background:#1E40AF; color:#FFFFFF; font-size:6.8pt; font-weight:700; padding:0.2mm 1.2mm; border-radius:0.5mm;">గన్నవరం</span>
              <p style="margin:1mm 0 0; font-weight:600; color:#111111;">మెడ్-టెక్ పార్కులో రూ. 1,850 కోట్ల నూతన పెట్టుబడుల ఒప్పందం.</p>
            </div>
            <div>
              <span style="background:#B45309; color:#FFFFFF; font-size:6.8pt; font-weight:700; padding:0.2mm 1.2mm; border-radius:0.5mm;">విజయవాడ</span>
              <p style="margin:1mm 0 0; font-weight:600; color:#111111;">అక్టోబర్ 24 నుంచి తుమ్మలపల్లిలో జాతీయ కూచిపూడి నాట్యోత్సవాలు.</p>
            </div>
          </div>
        </div>
      `;
    }

    // 5. Page 2 Cultural & District Diary Banner
    if (el.content_ref === 'edition.cultural_diary' || el.element_id.includes('cultural')) {
      return `
        <div class="plan-cultural-banner" style="${baseStyle} ${border} background:#FFFBEB; padding:${pad}mm; font-family:'Noto Sans Telugu',sans-serif; box-sizing:border-box;">
          <div style="background:#B45309; color:#FFFFFF; font-size:9pt; font-weight:800; padding:1.2mm 2.5mm; display:flex; justify-content:space-between; align-items:center; margin-bottom:2mm;">
            <span>ఆంధ్రప్రదేశ్ సాంస్కృతిక &amp; జిల్లా డైరీ — ప్రాంతీయ విశేషాలు</span>
            <span style="font-size:7.5pt; font-weight:600; color:#FEF3C7;">కళలు · సంస్కృతి · పర్యాటకం</span>
          </div>
          <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:3.5mm; font-size:8pt; line-height:1.35; color:#1C1917;">
            <div style="border-right:0.25mm solid #FDE68A; padding-right:2.5mm;">
              <strong style="color:#B45309;">విజయవాడ:</strong> తుమ్మలపల్లి కళాక్షేత్రంలో మూడు రోజుల పాటు రాష్ట్రస్థాయి కూచిపూడి నృత్యోత్సవాలు. 600 మంది కళాకారుల భాగస్వామ్యం.
            </div>
            <div style="border-right:0.25mm solid #FDE68A; padding-right:2.5mm;">
              <strong style="color:#065F46;">తిరుపతి:</strong> శీతాకాల యాత్రికుల రద్దీ దృష్ట్యా అలిపిరి, శ్రీవారి మెట్టు మార్గాల్లో అదనపు వైద్య శిబిరాలు, నిరంతర అన్నప్రసాద వితరణ.
            </div>
            <div style="border-right:0.25mm solid #FDE68A; padding-right:2.5mm;">
              <strong style="color:#1E40AF;">రాజమహేంద్రవరం:</strong> గోదావరి పుష్కర ఘాట్ల ఆధునీకరణకు ప్రణాళిక సిద్ధం. పర్యాటక అభివృద్ధికి రూ. 45 కోట్ల నిధుల మంజూరు.
            </div>
            <div>
              <strong style="color:#991B1B;">విశాఖపట్నం:</strong> రుషికొండ తీరంలో అంతర్జాతీయ సముద్ర పర్యాటక ఉత్సవాల ఏర్పాట్లు ముమ్మరం. నేటి సాయంత్రం వేడుకలు ప్రారంభం.
            </div>
          </div>
        </div>
      `;
    }

    // 6. Chief Editor's Column / Editorial on Page 2
    if (el.content_ref === 'edition.editorial' || el.element_id.includes('editorial')) {
      return `
        <div class="plan-editorial-box" style="${baseStyle} ${border} background:#FFFDF7; border:0.5mm double #991B1B; padding:2.5mm; font-family:'Noto Sans Telugu',sans-serif; box-sizing:border-box;">
          <div style="background:#991B1B; color:#FFFFFF; font-size:8.8pt; font-weight:800; padding:1mm 2.5mm; display:flex; justify-content:space-between; align-items:center; margin-bottom:2mm;">
            <span>సంపాదకీయం · ప్రజా పక్షం</span>
            <span style="font-size:7.5pt; font-weight:600; color:#FDE68A;">ప్రధాన సంపాదకుని విభాగం</span>
          </div>
          <div style="font-size:11pt; font-weight:800; color:#991B1B; line-height:1.25; margin-bottom:1.5mm;">
            సంపాదకీయం: ప్రజాస్వామ్య విలువల పరిరక్షణే లక్ష్యంగా సమగ్ర ప్రజా ప్రగతి
          </div>
          <div style="font-size:8pt; font-weight:700; color:#44403C; border-left:0.6mm solid #991B1B; padding-left:1.5mm; margin-bottom:2.5mm; line-height:1.35;">
            గ్రామీణ ప్రాంతాల ఆర్థిక పరిపుష్టి, నిరుద్యోగ నిర్మూలన మరియు సుపరిపాలన దిశగా వ్యవస్థాగత మార్పులు నేటి అత్యవసర కర్తవ్యం.
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:3mm; font-family:'Noto Serif Telugu',serif; font-size:7.8pt; line-height:1.42; color:#1C1917; text-align:justify;">
            <p style="margin:0 0 1.5mm;">సమకాలీన సమాజంలో ప్రజా సంక్షేమం మరియు సుస్థిర ఆర్థికాభివృద్ధి పరస్పర పూరకాలుగా ముందుకు సాగాల్సిన సమయమిది. గ్రామీణ ఆర్థిక వ్యవస్థను పటిష్టం చేయకుండా, క్షేత్రస్థాయి రైతాంగానికి నికరమైన ఆదాయ భరోసా కల్పించకుండా ఏ రాష్ట్రమూ సమగ్ర అభివృద్ధిని సాధించలేదు.</p>
            <p style="margin:0 0 1.5mm;">మౌలిక సదుపాయాల కల్పన, నాణ్యమైన విద్య, వైద్యం సమాజంలోని అట్టడుగు వర్గాలకు సైతం సమానంగా చేరువ కావాలి. సంక్షేమ పథకాలు కేవలం తాత్కాలిక ఊరటకే పరిమితం కాకుండా, దీర్ఘకాలిక మానవ వనరుల వికాసానికి, నైపుణ్యాభివృద్ధికి దోహదపడాలి.</p>
          </div>
          <p style="font-family:'Noto Serif Telugu',serif; font-size:7.8pt; line-height:1.42; color:#1C1917; text-align:justify; margin:0;">
            ప్రజాస్వామ్యంలో పౌరుల విశ్వాసమే పరిపాలనకు అసలైన బలం. బాధ్యతాయుతమైన పత్రికారంగం ఎల్లప్పుడూ ప్రజా సమస్యలను నిర్భయంగా వెలుగులోకి తీసుకురావడంతో పాటు, నిర్మాణాత్మక పరిష్కారాల దిశగా సమాజాన్ని నడిపించాలి.
          </p>
          <div style="margin-top:2mm; text-align:right; font-size:7.5pt; font-weight:700; color:#991B1B;">
            — ప్రధాన సంపాదకుడు, ప్రజా వాణి దినపత్రిక
          </div>
        </div>
      `;
    }

    // 7. Special Analysis / Sectoral Review on Page 2
    if (el.content_ref === 'edition.analysis' || el.element_id.includes('analysis')) {
      return `
        <div class="plan-analysis-box" style="${baseStyle} ${border} background:#F0FDF4; border:0.4mm solid #065F46; padding:2.5mm; font-family:'Noto Sans Telugu',sans-serif; box-sizing:border-box;">
          <div style="background:#065F46; color:#FFFFFF; font-size:8.8pt; font-weight:800; padding:1mm 2.5mm; display:flex; justify-content:space-between; align-items:center; margin-bottom:2mm;">
            <span>ప్రత్యేక విశ్లేషణ · రంగాల సమీక్ష</span>
            <span style="font-size:7.5pt; font-weight:600; color:#A7F3D0;">రాష్ట్రాభివృద్ధి</span>
          </div>
          <div style="font-size:10.5pt; font-weight:800; color:#065F46; line-height:1.25; margin-bottom:2mm;">
            ఈనాటి ప్రత్యేక విశ్లేషణ: పారిశ్రామికాభివృద్ధి - ఉపాధి విప్లవానికి సరికొత్త దారులు
          </div>
          <div style="font-size:7.8pt; font-weight:600; color:#1C1917; line-height:1.45; margin-bottom:2.5mm; background:#DCFCE7; padding:1.5mm; border-left:0.5mm solid #15803D;">
            ❖ ఐటీ, మెడ్-టెక్, గ్రీన్ ఎనర్జీ రంగాల్లో రూ. 12,000 కోట్ల నూతన ఒప్పందాలు.<br/>
            ❖ స్థానిక యువతకు పరిశ్రమల్లో 75 శాతం ఉపాధి భరోసా దిశగా నైపుణ్య శిక్షణ.<br/>
            ❖ విశాఖపట్నం, అమరావతి, తిరుపతిలలో నూతన ఇన్నోవేషన్ క్లస్టర్ల ఏర్పాటు.
          </div>
          <div style="font-family:'Noto Serif Telugu',serif; font-size:7.8pt; line-height:1.42; color:#1C1917; text-align:justify;">
            <p style="margin:0 0 1.5mm;">రాష్ట్రంలో పారిశ్రామిక పురోగతి సరికొత్త వేగాన్ని పుంజుకుంటోంది. గ్లోబల్ ఇన్వెస్ట్‌మెంట్ సదస్సుల ద్వారా కుదిరిన ఒప్పందాలు కేవలం కాగితాలకే పరిమితం కాకుండా, క్షేత్రస్థాయిలో ఉపాధి అవకాశాలుగా రూపాంతరం చెందుతున్నాయి.</p>
            <p style="margin:0;">ఐటీ, మెడ్-టెక్, మరియు తయారీ రంగాల్లో వస్తున్న నూతన పరిశ్రమలు గ్రామీణ, పట్టణ ప్రాంతాల మధ్య ఉన్న ఆర్థిక అసమానతలను తగ్గించడంలో కీలక పాత్ర పోషిస్తున్నాయి.</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="plan-bar plan-${el.type}" style="${baseStyle} background:${bg}; color:${el.typography?.color_hex || '#111111'}; font-size:${el.typography?.font_size_pt || 9.5}pt; font-weight:${el.typography?.font_weight || 700}; text-align:${el.typography?.alignment || 'left'}; padding:${pad}mm; ${border} display:flex; align-items:center; justify-content:center;">
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
    const borderWidth = el.style?.border_width_mm || 0.3;
    const borderColor = el.style?.border_color_hex || '#C7C2B8';

    return `
      <figure class="plan-photo" style="${baseStyle} border:${borderWidth}mm solid ${borderColor}; background:#E7E2D8; overflow:hidden;">
        <img src="${dataUri}" alt="${escapeHtml(asset?.captionTelugu || '')}" style="width:100%; height:100%; object-fit:${fit}; object-position:${fx}% ${fy}%; display:block;" />
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
  const fallbackStories = getAutonomousBureauFallbackStories();
  const articlesMap = new Map([
    ...fallbackStories.map((a) => [a.id, a] as [string, Article]),
    ...articles.map((a) => [a.id, a] as [string, Article]),
  ]);
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
    // Windows Chrome & Edge
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ...(process.env.LOCALAPPDATA ? [path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe')] : []),
    ...(process.env.PROGRAMFILES ? [path.join(process.env.PROGRAMFILES, 'Google\\Chrome\\Application\\chrome.exe')] : []),
    // Linux Chrome & Chromium
    '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell',
    '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    // Mac Chrome
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  for (const p of staticCandidates) {
    if (p && fs.existsSync(p)) return p;
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
