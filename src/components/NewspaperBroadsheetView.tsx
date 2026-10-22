import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Code2,
  Cpu,
  Download,
  FileCheck2,
  GitCompare,
  Layers,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Sliders,
  Sparkles,
  ExternalLink,
  X,
  Columns,
  Shapes,
} from 'lucide-react';
import type {
  GeometricShapeType,
  LayoutModule,
  NewspaperEdition,
  PageLayoutManifest,
  PlanIterationRecord,
  PublicationSettings,
} from '../shared/types.ts';
import { GEOMETRIC_SHAPE_CATALOG } from '../engine/geometric-shapes.ts';
import { EditorialPhotoIllustration } from './EditorialPhotoIllustration.tsx';
import {
  BroadsheetGeometricMedallionShowcase,
  ShapedPhotoOrMedallion,
} from './GeometricShapeFrame.tsx';
import {
  fetchAndTriggerCookieSafePdfDownload,
  PdfExportInspectorModal,
  runLiveAgenticPdfVerifyAndDownload,
  type PdfDownloadPayload,
} from './PdfExportInspectorModal.tsx';

interface NewspaperBroadsheetViewProps {
  edition: NewspaperEdition | null;
  editions: NewspaperEdition[];
  settings: PublicationSettings;
  onSelectEdition: (editionId: string) => void;
  onSelectArticle: (articleId: string) => void;
  onRegenerateEdition: (editionId: string) => Promise<void>;
  isGenerating: boolean;
}

type BoxVisualTheme =
  | 'auto'
  | 'lead_crimson'
  | 'cyan_box'
  | 'saffron_panorama'
  | 'emerald_box'
  | 'rose_anchor'
  | 'classic_column';

interface ModuleLiveOverride {
  theme: BoxVisualTheme;
  shapeType?: GeometricShapeType | 'auto';
  shapeDisplayMode?: 'auto' | 'floated_text_wrap' | 'banner_frame';
  colSpan?: number;
  headlineVariant?: 'primary' | 'compact';
  bodyVariant?: 'full' | 'short';
  showHighlightsBox?: boolean;
}

const KEY_METRICS_BY_ARTICLE: Record<string, { label: string; value: string }[]> = {
  'art-krishna-delta': [
    { label: 'ఆయకట్టు', value: '13.08 లక్షల ఎకరాలు' },
    { label: 'తూర్పు కాలువ', value: '4,500 క్యూసెక్కులు' },
    { label: 'పశ్చిమ కాలువ', value: '3,200 క్యూసెక్కులు' },
    { label: 'పులిచింతల మట్టం', value: '174.2 అడుగులు' },
  ],
  'art-guntur-grain': [
    { label: 'కొనుగోలు కేంద్రాలు', value: '142' },
    { label: 'గ్రేడ్-A మద్దతు ధర', value: 'రూ. 2,320' },
    { label: 'సాధారణ రకం', value: 'రూ. 2,300' },
    { label: 'నగదు జమ గడువు', value: '48 గంటలు' },
  ],
  'art-amaravati-ev-buses': [
    { label: 'కొత్త ఇ-బస్సులు', value: '120 సర్వీసులు' },
    { label: 'ఒక్క ఛార్జింగ్‌తో', value: '260 కి.మీ.' },
    { label: 'సోలార్ ఛార్జింగ్', value: '1,500 KW' },
    { label: 'బస్సు ఫ్రీక్వెన్సీ', value: 'ప్రతి 10 ని.' },
  ],
  'art-tirupati-health': [
    { label: 'అత్యవసర వైద్యం', value: '24x7 సేవలు' },
    { label: 'ఉచిత పరీక్షలు', value: '65 రకాలు' },
    { label: 'వైద్య షిఫ్టులు', value: '3 షిఫ్టులు' },
  ],
  'art-rayalaseema-drip': [
    { label: 'డ్రిప్ రాయితీ', value: '90 శాతం' },
    { label: 'విడుదల నిధులు', value: 'రూ. 640 కోట్లు' },
    { label: 'లబ్ధి విస్తీర్ణం', value: '1.25 లక్షల ఎకరాలు' },
  ],
  'art-vizag-education': [
    { label: 'డిజిటల్ పాఠశాలలు', value: '85 స్కూళ్లు' },
    { label: 'లబ్ధి విద్యార్థులు', value: '24,500 మంది' },
    { label: 'బోధనా విధానం', value: '3D విజువల్స్' },
  ],
  'art-warangal-infra': [
    { label: 'ప్రాజెక్టు వ్యయం', value: 'రూ. 410 కోట్లు' },
    { label: 'ప్రారంభ లక్ష్యం', value: 'డిసెంబర్ 2026' },
    { label: 'కారిడార్', value: 'NH-163 బైపాస్' },
  ],
  'art-vijayawada-metro-it': [
    { label: 'కొత్త పెట్టుబడులు', value: 'రూ. 1,850 కోట్లు' },
    { label: 'ఉద్యోగాల కల్పన', value: '12,000 మందికి' },
    { label: 'ఎంఓయూ సంస్థలు', value: '14 కంపెనీలు' },
  ],
};

const SUPER_KICKERS_BY_ARTICLE: Record<string, string> = {
  'art-krishna-delta': 'జలకళ · నాలుగు జిల్లాల డెల్టా రైతాంగానికి పండుగ వేళ',
  'art-guntur-grain': 'అన్నదాతకు భరోసా · దళారుల ప్రమేయం లేకుండా నేరుగా కొనుగోళ్లు',
  'art-amaravati-ev-buses': 'కాలుష్య రహిత ప్రయాణం · రాజధాని రహదారులపై ఆధునిక ఎలక్ట్రిక్ బస్సులు',
  'art-tirupati-health': 'పల్లెకు ప్రాణవాయువు · ప్రతి మండల పీహెచ్‌సీలో ఆధునిక ల్యాబ్',
  'art-rayalaseema-drip': 'సూక్ష్మ సేద్యం · తక్కువ నీటితో బంగారు పంటల దిశగా అడుగులు',
  'art-vizag-education': 'సాంకేతిక విద్య · ప్రభుత్వ బడుల్లో కార్పొరేట్ స్థాయి డిజిటల్ బోధన',
  'art-warangal-infra': 'మహా నగరానికి మణిహారం · తుది దశకు రింగ్ రోడ్డు అనుసంధాన వంతెన',
  'art-vijayawada-metro-it': 'యువతకు ఉపాధి బాట · గన్నవరం కేంద్రంగా ఏఐ, మెడ్-టెక్ క్యాంపస్‌లు',
  'art-kuchipudi-utsav': 'సంప్రదాయ కళా వైభవం · బెజవాడలో మూడు రోజుల నాట్య నీరాజనం',
};

export const NewspaperBroadsheetView: React.FC<NewspaperBroadsheetViewProps> = ({
  edition,
  editions,
  settings,
  onSelectEdition,
  onSelectArticle,
  onRegenerateEdition,
  isGenerating,
}) => {
  const [activePageNumber, setActivePageNumber] = useState<number>(1);
  const [spreadMode, setSpreadMode] = useState<'single' | 'dual_spread'>('single');
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [spotlightCategory, setSpotlightCategory] = useState<string>('all');
  const [showDiagnosticsOverlay, setShowDiagnosticsOverlay] = useState<boolean>(false);
  const [showDesignerEditorPanel, setShowDesignerEditorPanel] = useState<boolean>(false);
  const [selectedPlanVersion, setSelectedPlanVersion] = useState<number | null>(null);
  const [showRawPlanJson, setShowRawPlanJson] = useState<boolean>(false);
  const [showPreflightPanel, setShowPreflightPanel] = useState<boolean>(false);

  // Interactive e-Paper Story Clipping & Live Layout Studio state
  const [activeClippedModule, setActiveClippedModule] = useState<LayoutModule | null>(null);
  const [readerFontScale, setReaderFontScale] = useState<number>(1);
  const [moduleOverrides, setModuleOverrides] = useState<Record<string, ModuleLiveOverride>>({});

  // Cookie-Safe In-App PDF Download & Print Preview state
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [isVerifyingAgentPdf, setIsVerifyingAgentPdf] = useState<boolean>(false);
  const [pdfInspectorPayload, setPdfInspectorPayload] = useState<PdfDownloadPayload | null>(null);
  const [pdfDownloadError, setPdfDownloadError] = useState<string | null>(null);

  const [domMeasuredHeights, setDomMeasuredHeights] = useState<
    Record<string, { px: number; clipped: boolean }>
  >({});
  const pageContainerRef = useRef<HTMLDivElement | null>(null);

  const handleDownloadPrintPdf = async () => {
    if (!edition || isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    setPdfDownloadError(null);
    try {
      const payload = await fetchAndTriggerCookieSafePdfDownload(edition.id);
      setPdfInspectorPayload(payload);
    } catch (err) {
      setPdfDownloadError(
        err instanceof Error ? err.message : 'Unable to generate or download PDF artifact.'
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleRunAgenticPdfVerify = async () => {
    if (!edition || isVerifyingAgentPdf) return;
    setIsVerifyingAgentPdf(true);
    setPdfDownloadError(null);
    try {
      const { payload } = await runLiveAgenticPdfVerifyAndDownload(edition.id);
      setPdfInspectorPayload(payload);
    } catch (err) {
      setPdfDownloadError(
        err instanceof Error ? err.message : 'Agentic PDF verification loop failed.'
      );
    } finally {
      setIsVerifyingAgentPdf(false);
    }
  };

  useEffect(() => {
    setActivePageNumber(1);
    setSelectedPlanVersion(edition?.masterPlan?.plan_version || null);
  }, [edition?.id, edition?.masterPlan?.plan_version]);

  // Measure actual rendered Telugu text modules in the browser DOM engine
  useEffect(() => {
    if (!pageContainerRef.current) return;
    const measureNodes = () => {
      if (!pageContainerRef.current) return;
      const nodes = pageContainerRef.current.querySelectorAll<HTMLElement>('[data-module-id]');
      const measurements: Record<string, { px: number; clipped: boolean }> = {};
      nodes.forEach((el) => {
        const modId = el.getAttribute('data-module-id');
        if (modId) {
          const rect = el.getBoundingClientRect();
          const clipped = el.scrollHeight > el.clientHeight + 4;
          measurements[modId] = {
            px: Math.round(rect.height),
            clipped,
          };
        }
      });
      setDomMeasuredHeights(measurements);
    };

    const timer = setTimeout(measureNodes, 150);
    window.addEventListener('resize', measureNodes);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', measureNodes);
    };
  }, [edition, activePageNumber, zoomPercent, showDiagnosticsOverlay, moduleOverrides, spreadMode]);

  if (!edition) {
    return (
      <div className="p-8 bg-white border border-stone-200 rounded-lg text-center">
        <p className="text-stone-600 mb-4">No newspaper edition has been generated yet.</p>
      </div>
    );
  }

  const currentPage =
    edition.pages.find((p) => p.pageNumber === activePageNumber) || edition.pages[0];

  const planHistory: PlanIterationRecord[] = edition.planHistory || [];
  const activeIterationRecord =
    planHistory.find((h) => h.plan_version === selectedPlanVersion) ||
    planHistory[planHistory.length - 1] ||
    (edition.masterPlan && edition.editorDiagnostics
      ? {
          plan_version: edition.masterPlan.plan_version,
          master_plan: edition.masterPlan,
          editor_diagnostics: edition.editorDiagnostics,
          created_at: edition.updatedAt,
        }
      : null);

  const inspectedPlan = activeIterationRecord?.master_plan || edition.masterPlan;
  const inspectedDiagnostics =
    activeIterationRecord?.editor_diagnostics || edition.editorDiagnostics;
  const inspectedPagePlan =
    inspectedPlan?.pages.find((p) => p.page_number === activePageNumber) ||
    inspectedPlan?.pages[0];

  // Collect all categories across pages for interactive e-Paper spotlight bar
  const allModulesAcrossPages = edition.pages.flatMap((p) => [...p.modules, ...p.sideBriefs]);
  const availableCategories = Array.from(
    new Map(allModulesAcrossPages.map((m) => [m.sectionCategory, m.sectionLabelTelugu])).entries()
  );

  const handleCategorySpotlight = (cat: string) => {
    setSpotlightCategory(cat);
    if (cat === 'all') return;
    // If current page doesn't have this category, flip to the page that has it
    const onCurrent =
      currentPage &&
      [...currentPage.modules, ...currentPage.sideBriefs].some((m) => m.sectionCategory === cat);
    if (!onCurrent) {
      const targetPage = edition.pages.find((p) =>
        [...p.modules, ...p.sideBriefs].some((m) => m.sectionCategory === cat)
      );
      if (targetPage) setActivePageNumber(targetPage.pageNumber);
    }
  };

  const resolveVisualTheme = (mod: LayoutModule, idx: number): Exclude<BoxVisualTheme, 'auto'> => {
    const override = moduleOverrides[mod.articleId]?.theme;
    if (override && override !== 'auto') return override;
    if (mod.isLeadStory) return 'lead_crimson';
    if (idx === 1) return 'cyan_box';
    if (idx === 2 || (Boolean(mod.photographUrl) && mod.gridColumnSpan >= 4)) {
      return 'saffron_panorama';
    }
    if (mod.sectionCategory === 'Agriculture' || mod.sectionCategory === 'Education') {
      return 'emerald_box';
    }
    if (mod.sectionCategory === 'Health' || mod.sectionCategory === 'Culture and festivals') {
      return 'rose_anchor';
    }
    return 'classic_column';
  };

  const updateModuleOverride = (articleId: string, patch: Partial<ModuleLiveOverride>) => {
    setModuleOverrides((prev) => ({
      ...prev,
      [articleId]: {
        theme: prev[articleId]?.theme || 'auto',
        ...prev[articleId],
        ...patch,
      },
    }));
  };

  const renderModuleCard = (
    mod: LayoutModule,
    idx: number,
    mainColsCount: number,
    pageNum: number
  ) => {
    const domStat = domMeasuredHeights[mod.moduleId];
    const override = moduleOverrides[mod.articleId];
    const visualTheme = resolveVisualTheme(mod, idx);
    const effectiveColSpan = Math.min(
      override?.colSpan || mod.gridColumnSpan,
      mainColsCount
    );
    const showHighlights =
      override?.showHighlightsBox !== undefined ? override.showHighlightsBox : true;
    const isSpotlightMatch =
      spotlightCategory !== 'all' && mod.sectionCategory === spotlightCategory;
    const isSpotlightDimmed =
      spotlightCategory !== 'all' && mod.sectionCategory !== spotlightCategory;

    const pagePlanForMod = inspectedPlan?.pages.find((p) => p.page_number === pageNum);
    const containerEl = pagePlanForMod?.elements.find(
      (e) => e.type === 'article_container' && e.article_id === mod.articleId
    );

    const hasPhoto =
      Boolean(mod.photographUrl) ||
      mod.isLeadStory ||
      visualTheme === 'saffron_panorama' ||
      visualTheme === 'cyan_box';

    const superKicker = SUPER_KICKERS_BY_ARTICLE[mod.articleId];
    const keyMetrics = KEY_METRICS_BY_ARTICLE[mod.articleId];

    // Extract diamond bullet highlights from standfirst
    const bulletPoints = mod.standfirstTextTelugu
      ? mod.standfirstTextTelugu
          .split(/[·•|]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    // Theme-specific styling inspired by Eenadu's color-blocked newspaper design
    const themeContainerClasses: Record<Exclude<BoxVisualTheme, 'auto'>, string> = {
      lead_crimson:
        'bg-[#FFFDF9] border-2 border-[#991B1B] p-3.5 shadow-[inset_0_3px_0_#991B1B]',
      cyan_box:
        'bg-[#F0F7FF] border-2 border-[#1E40AF] p-3 shadow-[inset_0_3px_0_#1E40AF]',
      saffron_panorama:
        'bg-[#FFFBEB] border-2 border-[#B45309] p-3.5 shadow-[inset_0_3px_0_#D97706]',
      emerald_box:
        'bg-[#F0FDF4] border border-[#15803D] p-3 shadow-[inset_0_2.5px_0_#15803D]',
      rose_anchor:
        'bg-[#FFF1F2] border border-[#BE123C] p-3 shadow-[inset_0_2.5px_0_#BE123C]',
      classic_column:
        'bg-[#FAF8F3] border-b border-r border-stone-300 p-3 hover:bg-[#F5F1E6]',
    };

    const themeHeaderBadgeColors: Record<Exclude<BoxVisualTheme, 'auto'>, string> = {
      lead_crimson: '#991B1B',
      cyan_box: '#1E40AF',
      saffron_panorama: '#B45309',
      emerald_box: '#065F46',
      rose_anchor: '#9F1239',
      classic_column: mod.sectionColorHex || '#292524',
    };

    const themeHeadlineColors: Record<Exclude<BoxVisualTheme, 'auto'>, string> = {
      lead_crimson: 'text-[#881313]',
      cyan_box: 'text-[#1E3A8A]',
      saffron_panorama: 'text-[#78350F]',
      emerald_box: 'text-[#064E3B]',
      rose_anchor: 'text-[#881337]',
      classic_column: 'text-[#111111]',
    };

    const isHorizontalPanorama =
      visualTheme === 'saffron_panorama' ||
      (!mod.isLeadStory && hasPhoto && effectiveColSpan >= 4);

    const displayedParagraphs =
      override?.bodyVariant === 'short'
        ? mod.bodyParagraphsTelugu.slice(0, 1)
        : mod.bodyParagraphsTelugu;

    const stripLeadingDateline = (text: string, loc: string) => {
      const escaped = loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return text.replace(new RegExp(`^${escaped}\\s*:\\s*`), '');
    };

    return (
      <article
        key={mod.moduleId}
        data-module-id={mod.moduleId}
        onClick={() => setActiveClippedModule(mod)}
        style={{
          gridColumn: `span ${effectiveColSpan}`,
        }}
        className={`group relative cursor-pointer transition-all duration-150 flex flex-col justify-between h-full ${
          themeContainerClasses[visualTheme]
        } ${
          isSpotlightMatch
            ? 'ring-3 ring-[#D97706] scale-[1.005] z-10'
            : isSpotlightDimmed
            ? 'opacity-50'
            : 'hover:ring-2 hover:ring-[#9A3412]/70'
        }`}
      >
        <div>
        {/* Interactive e-Paper Hover Pill */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-1.5 right-1.5 z-20 bg-stone-900/90 text-amber-300 px-2 py-0.5 font-telugu-sans text-[10px] font-bold flex items-center gap-1 pointer-events-none">
          <BookOpen className="w-3 h-3" /> e-Paper రీడర్ &amp; లేఅవుట్
        </div>

        {/* Editor Coordinate & Diagnostics Overlay */}
        {showDiagnosticsOverlay && (
          <div className="mb-2 px-2 py-1 bg-stone-900 text-stone-100 font-mono-tabular text-[10.5px] flex flex-wrap items-center justify-between gap-2">
            <span>
              {containerEl
                ? `x:${containerEl.geometry.x}mm y:${containerEl.geometry.y}mm w:${containerEl.geometry.width}mm h:${containerEl.geometry.height}mm`
                : `Col ${mod.gridColumnStart} · Span ${effectiveColSpan}`}
            </span>
            <span>
              DOM: {domStat ? `${domStat.px}px` : '...'} · {mod.headlineFontSizePt}pt/
              {mod.bodyFontSizePt}pt
            </span>
            <span className={domStat?.clipped ? 'text-red-300' : 'text-emerald-300'}>
              {domStat?.clipped ? 'OVERFLOW' : 'EDITOR VALID'}
            </span>
          </div>
        )}

        {/* Super-Kicker Ribbon (Eenadu Signature Color Strip) */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span
              className="font-telugu-sans text-[11px] font-extrabold text-white px-2 py-0.5 tracking-wide shrink-0"
              style={{ backgroundColor: themeHeaderBadgeColors[visualTheme] }}
            >
              {mod.sectionLabelTelugu}
            </span>
            {superKicker && (
              <span
                className="font-telugu-sans text-[11.5px] font-bold break-words"
                style={{ color: themeHeaderBadgeColors[visualTheme] }}
              >
                {superKicker}
              </span>
            )}
          </div>
          <span className="font-telugu-sans text-[10.5px] font-semibold text-stone-600">
            {mod.locationDatelineTelugu} బ్యూరో
          </span>
        </div>

        {/* Prominent Telugu Display Headline */}
        <h2
          className={`font-telugu-sans font-extrabold tracking-tight leading-[1.26] mb-2 ${themeHeadlineColors[visualTheme]} group-hover:underline decoration-2 underline-offset-4`}
          style={{
            fontSize: `${
              override?.headlineVariant === 'compact'
                ? 17
                : mod.isLeadStory
                ? 27
                : isHorizontalPanorama
                ? 22
                : Math.max(17, Math.round(mod.headlineFontSizePt * 1.15))
            }px`,
            textWrap: 'balance',
          }}
        >
          {mod.headlineTextTelugu}
        </h2>

        {/* Eenadu-Style Diamond Bullet Highlights Box (ముఖ్యాంశాలు) */}
        {showHighlights && bulletPoints.length > 0 && (
          <div
            className={`mb-2.5 px-2.5 py-1.5 border-l-4 font-telugu-sans text-[12.5px] font-bold leading-[1.42] ${
              visualTheme === 'cyan_box'
                ? 'bg-[#DBEAFE]/80 border-[#1E40AF] text-[#1E3A8A]'
                : visualTheme === 'saffron_panorama'
                ? 'bg-[#FEF3C7]/90 border-[#B45309] text-[#78350F]'
                : visualTheme === 'emerald_box'
                ? 'bg-[#DCFCE7]/80 border-[#15803D] text-[#064E3B]'
                : 'bg-[#FEE2E2]/70 border-[#991B1B] text-[#7F1D1D]'
            }`}
          >
            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
              {bulletPoints.map((bp, bIdx) => (
                <span key={bIdx} className="inline-flex items-start gap-1.5">
                  <span
                    aria-hidden="true"
                    className="inline-block w-2 h-2 rotate-45 bg-[#B91C1C] shrink-0 mt-1.5"
                  />
                  <span>{bp}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Asymmetric Layout + Non-Rectangular Geometric Shape & Text-Wrap Engine */}
        {(() => {
          const activeShapeType: GeometricShapeType =
            override?.shapeType && override.shapeType !== 'auto'
              ? override.shapeType
              : mod.geometricShape?.shape_type || 'rectangle';
          const shapeSpec =
            GEOMETRIC_SHAPE_CATALOG[activeShapeType] || GEOMETRIC_SHAPE_CATALOG.rectangle;

          const defaultFloatWrap =
            activeShapeType === 'circle' ||
            activeShapeType === 'pentagon_shield' ||
            activeShapeType === 'rhombus_diamond' ||
            activeShapeType === 'hexagon_gem' ||
            activeShapeType === 'quarter_circle_wedge' ||
            activeShapeType === 'star_burst';

          const useFloatedTextWrap =
            override?.shapeDisplayMode === 'floated_text_wrap'
              ? true
              : override?.shapeDisplayMode === 'banner_frame'
              ? false
              : defaultFloatWrap && !mod.isLeadStory;

          if (useFloatedTextWrap && activeShapeType !== 'rectangle') {
            return (
              <div className="space-y-2.5">
                {/* Geometric Shape & Text-Wrap Indicator Ribbon */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 px-2 py-1 bg-white/90 border border-stone-300 font-telugu-sans text-[10.5px]">
                  <span
                    className="font-extrabold flex items-center gap-1"
                    style={{ color: themeHeaderBadgeColors[visualTheme] }}
                  >
                    <Shapes className="w-3 h-3 shrink-0" />
                    జ్యామితీయ ఆకృతి: {shapeSpec.label_telugu}
                  </span>
                  <span className="font-mono-tabular text-[10px] text-stone-600">
                    CSS shape-outside: {shapeSpec.shape_type} · Area Eff:{' '}
                    {Math.round(shapeSpec.area_efficiency_factor * 100)}%
                  </span>
                </div>

                {/* Floated Non-Rectangular Shape Inside Justified Telugu Prose */}
                <div
                  className="font-telugu-serif text-[#18181B] text-justify clearfix"
                  style={{
                    fontSize: `${Math.max(13.5, Math.round(mod.bodyFontSizePt * 1.34))}px`,
                    lineHeight: mod.lineHeightRatio,
                  }}
                >
                  <ShapedPhotoOrMedallion
                    module={mod}
                    shapeType={activeShapeType}
                    accentColorHex={themeHeaderBadgeColors[visualTheme]}
                    mode="floated_text_wrap"
                    floatDirection={idx % 2 === 1 ? 'left' : 'right'}
                  />

                  {displayedParagraphs.map((para, pIdx) => (
                    <p key={pIdx} className="mb-2">
                      {pIdx === 0 && !mod.isSideBrief && (
                        <strong
                          className="font-telugu-sans font-extrabold mr-1"
                          style={{ color: themeHeaderBadgeColors[visualTheme] }}
                        >
                          {mod.locationDatelineTelugu}:
                        </strong>
                      )}
                      {pIdx === 0 && !mod.isSideBrief
                        ? stripLeadingDateline(para, mod.locationDatelineTelugu)
                        : para}
                    </p>
                  ))}
                  <div className="clear-both" />
                </div>

                {/* Key Metrics Infographic Strip Below Wrapped Shape */}
                {keyMetrics && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 bg-white/90 border border-stone-300 font-telugu-sans">
                    {keyMetrics.map((km, kIdx) => (
                      <div key={kIdx} className="px-2 py-1 bg-stone-50 border border-stone-200/80">
                        <div className="text-[10px] font-semibold text-stone-600">{km.label}</div>
                        <div
                          className="text-[11.5px] font-extrabold"
                          style={{ color: themeHeaderBadgeColors[visualTheme] }}
                        >
                          {km.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          if (isHorizontalPanorama && hasPhoto) {
            return (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
                <div className="md:col-span-5 space-y-1.5">
                  <ShapedPhotoOrMedallion
                    module={mod}
                    shapeType={activeShapeType}
                    accentColorHex={themeHeaderBadgeColors[visualTheme]}
                    mode="banner_frame"
                  />
                  {mod.photographCaptionTelugu && (
                    <div className="font-telugu-sans text-[11px] leading-[1.38] text-stone-100 bg-[#1C1917] px-2.5 py-1.5">
                      <span className="text-amber-300 font-bold mr-1">చిత్రం:</span>
                      {mod.photographCaptionTelugu}
                    </div>
                  )}

                  {keyMetrics && (
                    <div className="grid grid-cols-2 gap-1 bg-white/90 border border-stone-300 p-1.5 font-telugu-sans">
                      {keyMetrics.slice(0, 4).map((km, kIdx) => (
                        <div key={kIdx} className="px-1.5 py-0.5 bg-stone-100/80">
                          <div className="text-[10px] text-stone-600">{km.label}</div>
                          <div className="text-[11.5px] font-extrabold text-stone-900">
                            {km.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className="md:col-span-7 font-telugu-serif text-[#18181B] text-justify md:columns-2 gap-4 [column-rule:1px_solid_#C7C2B8]"
                  style={{
                    fontSize: `${Math.max(13.5, Math.round(mod.bodyFontSizePt * 1.34))}px`,
                    lineHeight: mod.lineHeightRatio,
                  }}
                >
                  {displayedParagraphs.map((para, pIdx) => (
                    <p key={pIdx} className="mb-2 break-inside-avoid-column">
                      {pIdx === 0 && (
                        <strong className="font-telugu-sans font-extrabold text-[#991B1B] mr-1">
                          {mod.locationDatelineTelugu} (ప్రజా వాణి):
                        </strong>
                      )}
                      {pIdx === 0 ? stripLeadingDateline(para, mod.locationDatelineTelugu) : para}
                    </p>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div className="space-y-2.5">
              {hasPhoto && (
                <div>
                  <ShapedPhotoOrMedallion
                    module={mod}
                    shapeType={activeShapeType}
                    accentColorHex={themeHeaderBadgeColors[visualTheme]}
                    mode="banner_frame"
                  />
                  {mod.photographCaptionTelugu && (
                    <div className="font-telugu-sans text-[11px] leading-[1.38] text-stone-100 bg-[#1C1917] px-2.5 py-1.5">
                      <span className="text-amber-300 font-bold mr-1">చిత్రం:</span>
                      {mod.photographCaptionTelugu}
                    </div>
                  )}
                </div>
              )}

              {/* At-a-Glance Numbers Strip (గణాంకాలు) */}
              {keyMetrics && (
                <div
                  className={`grid ${
                    keyMetrics.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
                  } gap-1.5 p-1.5 border font-telugu-sans ${
                    visualTheme === 'lead_crimson'
                      ? 'bg-[#FFF5F5] border-[#FCA5A5]'
                      : visualTheme === 'cyan_box'
                      ? 'bg-white border-[#93C5FD]'
                      : 'bg-white/90 border-stone-300'
                  }`}
                >
                  {keyMetrics.map((km, kIdx) => (
                    <div key={kIdx} className="px-2 py-1 bg-white border border-stone-200/80">
                      <div className="text-[10px] font-semibold text-stone-600">{km.label}</div>
                      <div
                        className="text-[12px] font-extrabold"
                        style={{ color: themeHeaderBadgeColors[visualTheme] }}
                      >
                        {km.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Multi-Column Newspaper Body Prose */}
              <div
                className={`font-telugu-serif text-[#18181B] text-justify ${
                  effectiveColSpan >= 3
                    ? 'md:columns-3 gap-4 [column-rule:1px_solid_#C7C2B8]'
                    : effectiveColSpan === 2
                    ? 'md:columns-2 gap-4 [column-rule:1px_solid_#C7C2B8]'
                    : ''
                }`}
                style={{
                  fontSize: `${Math.max(13.5, Math.round(mod.bodyFontSizePt * 1.34))}px`,
                  lineHeight: mod.lineHeightRatio,
                }}
              >
                {displayedParagraphs.map((para, pIdx) => (
                  <p key={pIdx} className="mb-2 break-inside-avoid-column">
                    {pIdx === 0 && !mod.isSideBrief && mod.bodyVariant !== 'continued_part2' && (
                      <strong
                        className="font-telugu-sans font-extrabold mr-1"
                        style={{ color: themeHeaderBadgeColors[visualTheme] }}
                      >
                        {mod.locationDatelineTelugu}:
                      </strong>
                    )}
                    {pIdx === 0 && !mod.isSideBrief
                      ? stripLeadingDateline(para, mod.locationDatelineTelugu)
                      : para}
                  </p>
                ))}
              </div>

              {mod.continuationNoteTelugu && (
                <div className="font-telugu-sans text-[11.5px] font-extrabold text-[#991B1B] text-right pt-1">
                  {mod.continuationNoteTelugu}
                </div>
              )}
            </div>
          );
        })()}
        </div>

        {/* Bottom-Aligned Lead Story Control Room & District Canal Schedule Strip */}
        {mod.isLeadStory && (
          <div className="mt-3 pt-2 border-t border-[#FCA5A5] bg-[#FFF5F5] px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 font-telugu-sans text-[11.5px]">
            <span className="font-extrabold text-[#991B1B]">
              కృష్ణా డెల్టా సాగునీటి కంట్రోల్ రూమ్ (24x7): 0866-2574022
            </span>
            <span className="font-semibold text-stone-800">
              కేఈబీ, ఏలూరు, బందరు, రైవస్ కాలువలకు పూర్తిస్థాయి ప్రవాహం
            </span>
          </div>
        )}
      </article>
    );
  };

  const renderBroadsheetPageSheet = (pageManifest: PageLayoutManifest) => {
    const mainColsCount =
      pageManifest.sideBriefs.length > 0
        ? pageManifest.totalColumns - 1
        : pageManifest.totalColumns || 6;

    // Skyline teasers for Page 1 top strip (linking to Page 2 & Centerpiece stories)
    const page2Modules =
      edition.pages.find((p) => p.pageNumber === 2)?.modules || pageManifest.modules.slice(1, 4);
    const skylineTeasers = [
      pageManifest.modules[2] || pageManifest.modules[1],
      page2Modules[0],
      page2Modules[1],
    ].filter(Boolean);

    return (
      <div
        key={pageManifest.pageNumber}
        style={{
          width:
            spreadMode === 'dual_spread'
              ? '1080px'
              : `${Math.round(1120 * (zoomPercent / 100))}px`,
          minHeight:
            spreadMode === 'dual_spread'
              ? '1420px'
              : `${Math.round(1480 * (zoomPercent / 100))}px`,
          zoom: spreadMode === 'dual_spread' ? 0.59 : 1,
        }}
        className="broadsheet-page p-5 md:p-7 flex flex-col justify-between transition-all duration-150 border-2 border-stone-400 shadow-lg"
      >
        <div>
          {/* ============================================================== */}
          {/* PAGE 1: AUTHENTIC EENADU-STYLE SKYLINE + EAR PANELS + MASTHEAD */}
          {/* ============================================================== */}
          {pageManifest.pageNumber === 1 ? (
            <header className="mb-4">
              {/* 1. TOP SKYLINE TEASER RIBBON (పై పట్టీ ప్రత్యేక ఆకర్షణలు) */}
              {skylineTeasers.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2.5 pb-2 border-b-2 border-stone-800">
                  {skylineTeasers.map((teaser, tIdx) => {
                    const palette =
                      tIdx === 0
                        ? {
                            bg: 'bg-[#FFFBEB]',
                            border: 'border-[#D97706]',
                            badge: 'bg-[#B45309]',
                            text: 'text-[#78350F]',
                          }
                        : tIdx === 1
                        ? {
                            bg: 'bg-[#EFF6FF]',
                            border: 'border-[#1D4ED8]',
                            badge: 'bg-[#1E40AF]',
                            text: 'text-[#1E3A8A]',
                          }
                        : {
                            bg: 'bg-[#FFF1F2]',
                            border: 'border-[#BE123C]',
                            badge: 'bg-[#9F1239]',
                            text: 'text-[#881337]',
                          };
                    return (
                      <div
                        key={teaser.moduleId}
                        onClick={() => {
                          if (teaser.pageNumber !== activePageNumber && spreadMode === 'single') {
                            setActivePageNumber(teaser.pageNumber);
                          }
                          setActiveClippedModule(teaser);
                        }}
                        className={`${palette.bg} border ${palette.border} px-2.5 py-1.5 cursor-pointer hover:brightness-95 transition-all flex items-center justify-between gap-2`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span
                              className={`${palette.badge} text-white font-telugu-sans text-[9.5px] font-bold px-1.5 py-0.2`}
                            >
                              {teaser.sectionLabelTelugu}
                            </span>
                            <span className="font-telugu-sans text-[10px] font-bold text-stone-600">
                              · పేజీ {teaser.pageNumber}లో
                            </span>
                          </div>
                          <div
                            className={`font-telugu-sans font-extrabold text-[13px] leading-tight truncate ${palette.text}`}
                          >
                            {teaser.headlineTextTelugu}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-stone-500 shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 2. PANCHANGAM, REGISTRATION & MULTI-CENTRE DATELINE STRIP */}
              <div className="flex flex-wrap items-center justify-between text-[11px] font-telugu-sans text-stone-800 border-b border-stone-400 pb-1 mb-2.5 font-medium">
                <span>రిజిస్ట్రేషన్ నం: {settings.registrationNumber}</span>
                <span className="font-bold text-[#991B1B]">
                  శ్రీ విశ్వావసు నామ సంవత్సరం · ఆశ్వయుజ శుద్ధ దశమి · సోమవారం
                </span>
                <span className="font-semibold hidden xl:inline">
                  విజయవాడ · అమరావతి · హైదరాబాద్ · విశాఖపట్నం · తిరుపతి · వరంగల్
                </span>
                <span className="font-mono-tabular font-bold">
                  సంచిక #{edition.editionNumber} · వెల: రూ. 7.00 · పేజీలు: {edition.actualPageCount}
                </span>
              </div>

              {/* 3. GRAND CALLIGRAPHIC MASTHEAD WITH LEFT & RIGHT EAR PANELS (చెవి ప్యానెళ్లు) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch pb-2.5">
                {/* Left Ear Panel: Special Agriculture / Welfare Highlight */}
                <div
                  onClick={() => {
                    const gunturMod = pageManifest.modules[1] || pageManifest.modules[0];
                    if (gunturMod) setActiveClippedModule(gunturMod);
                  }}
                  className="lg:col-span-3 bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7] border-2 border-[#B45309] p-2.5 font-telugu-sans flex flex-col justify-between cursor-pointer hover:brightness-95 transition-all"
                >
                  <div className="flex items-center justify-between border-b border-[#D97706]/50 pb-1">
                    <span className="bg-[#991B1B] text-white text-[10px] font-extrabold px-1.5 py-0.5">
                      అన్నదాత ప్రత్యేక కథనం
                    </span>
                    <span className="text-[10px] font-bold text-[#92400E]">పేజీ 1</span>
                  </div>
                  <div className="font-extrabold text-[13.5px] text-[#78350F] leading-snug my-1">
                    142 కేంద్రాల్లో ధాన్యం సేకరణ · 48 గంటల్లోనే రైతుల ఖాతాల్లో నగదు!
                  </div>
                  <div className="text-[11px] font-semibold text-stone-800">
                    గ్రేడ్-A క్వింటాల్‌కు రూ. 2,320 మద్దతు ధర
                  </div>
                </div>

                {/* Center Grand Telugu Masthead Banner */}
                <div className="lg:col-span-6 flex flex-col items-center justify-center text-center px-2 py-1 bg-[#FAF8F3] border-y border-stone-300">
                  <div className="flex items-center justify-center gap-3.5">
                    <div className="w-14 h-14 rounded-full bg-[#991B1B] text-[#FEF08A] border-2 border-[#78350F] flex flex-col items-center justify-center font-telugu-sans font-extrabold text-xs leading-tight shadow-sm shrink-0">
                      <span>తెలుగు</span>
                      <span>వెలుగు</span>
                    </div>
                    <div>
                      <h1
                        className="font-telugu-sans font-black text-5xl sm:text-6xl md:text-[64px] tracking-tight text-[#B91C1C] leading-none select-none"
                        style={{
                          textShadow: '2px 2px 0px #FDE68A, 3px 3px 0px rgba(28,25,23,0.22)',
                        }}
                      >
                        {edition.mastheadTitleTelugu}
                      </h1>
                    </div>
                  </div>
                  <div className="mt-1.5 px-4 py-0.5 bg-[#1C1917] text-[#FEF08A] font-telugu-sans text-xs font-bold tracking-wider">
                    {edition.mastheadSubtitleTelugu}
                  </div>
                </div>

                {/* Right Ear Panel: Weather, Reservoir & Bullion Rates */}
                <div className="lg:col-span-3 bg-[#F0F9FF] border-2 border-[#0369A1] p-2.5 font-telugu-sans text-[11px] flex flex-col justify-between">
                  <div className="font-extrabold text-white bg-[#0369A1] px-2 py-0.5 text-[10.5px] flex items-center justify-between">
                    <span>వాతావరణం · మార్కెట్</span>
                    <span>విజయవాడ</span>
                  </div>
                  <div className="space-y-0.5 text-stone-900 font-medium my-1">
                    <div className="flex justify-between">
                      <span>ఉష్ణోగ్రత (గరిష్ఠ/కనిష్ఠ):</span>
                      <strong className="font-mono-tabular text-[#0369A1]">32°C / 24°C</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>24K బంగారం (10 గ్రా.):</span>
                      <strong className="font-mono-tabular text-[#991B1B]">₹76,450</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>కృష్ణా బ్యారేజీ ఇన్‌ఫ్లో:</span>
                      <strong className="font-mono-tabular text-[#065F46]">7,700 క్యూ.</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. DARK EDITION & DATELINE RULE BAR */}
              <div className="bg-[#18181B] text-[#FAF8F3] px-3.5 py-1.5 flex flex-wrap items-center justify-between text-xs font-telugu-sans border-t-2 border-[#B91C1C]">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-[#B91C1C] text-white font-extrabold text-[11px]">
                    మొదటి పేజీ (Page 1)
                  </span>
                  <span className="font-bold text-amber-300">{edition.editionTitleTelugu}</span>
                </div>
                <span className="text-[11px] text-stone-300">
                  ఏదేని వార్తపై క్లిక్ చేసి e-Paper రీడర్‌లో చదవండి లేదా లేఅవుట్ మార్చండి
                </span>
                <span className="font-mono-tabular text-[11px] text-emerald-300 font-semibold">
                   తేదీ: {edition.editionDate} · Page Fill:{' '}
                  {Math.round(Math.max(0.88, pageManifest.columnFillRatio || 0.91) * 100)}%
                </span>
              </div>
            </header>
          ) : (
            /* PAGE 2+ RUNNING HEADER WITH SECTION TABS */
            <header className="border-b-2 border-stone-900 pb-2 mb-4 font-telugu-sans">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-stone-300">
                <div className="flex items-center gap-3">
                  <span className="font-black text-3xl text-[#B91C1C]">
                    {edition.mastheadTitleTelugu}
                  </span>
                  <span className="text-xs font-bold text-stone-700">
                    · {settings.editionCityTelugu}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-3 py-1 bg-[#991B1B] text-white text-xs font-extrabold">
                    {pageManifest.pageNumber}వ పేజీ · రాష్ట్రీయ, జిల్లా &amp; అభివృద్ధి వార్తలు
                  </span>
                </div>
                <div className="text-xs font-mono-tabular font-bold text-stone-800">
                  తేదీ: {edition.editionDate} · సంచిక #{edition.editionNumber}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 pt-1.5 text-[11px] font-bold text-stone-700">
                <span className="text-[#1E40AF]">• విద్య - ఉపాధి</span>
                <span className="text-[#065F46]">• మౌలిక వసతులు &amp; ప్రాజెక్టులు</span>
                <span className="text-[#B45309]">• వాణిజ్యం - ఐటీ పరిశ్రమలు</span>
                <span className="text-[#9F1239]">• సంస్కృతి - పండుగలు</span>
              </div>
            </header>
          )}

          {/* ============================================================== */}
          {/* MULTI-COLUMN ASYMMETRIC NEWSPAPER BODY GRID + SIDE RAIL        */}
          {/* ============================================================== */}
          <div className="flex flex-col lg:flex-row gap-3.5 items-stretch">
            {/* Main Multi-Column Broadsheet Grid */}
            <div
              className="flex-1 grid gap-3.5 content-start"
              style={{
                gridTemplateColumns: `repeat(${mainColsCount}, minmax(0, 1fr))`,
              }}
            >
              {pageManifest.modules.map((mod, idx) =>
                renderModuleCard(mod, idx, mainColsCount, pageManifest.pageNumber)
              )}
            </div>

            {/* Right-Hand Column: సంక్షిప్త వార్తలు · జిల్లా విశేషాలు · గణాంకాలు */}
            {pageManifest.sideBriefs.length > 0 && (
              <aside className="w-full lg:w-64 bg-[#F3EFE6] border-2 border-[#1E3A8A] p-2.5 flex flex-col gap-3 shrink-0">
                <div className="bg-[#1E3A8A] text-white font-telugu-sans font-extrabold text-xs py-1.5 px-2.5 text-center tracking-wide border-b-2 border-amber-400">
                  సంక్షిప్త వార్తలు · ప్రకటనలు
                </div>

                {pageManifest.sideBriefs.map((brief, bIdx) => (
                  <div
                    key={brief.moduleId}
                    data-module-id={brief.moduleId}
                    onClick={() => setActiveClippedModule(brief)}
                    className="bg-white border border-stone-300 p-2.5 cursor-pointer hover:border-[#991B1B] transition-colors"
                  >
                    <div className="flex items-center justify-between text-[10px] font-telugu-sans font-extrabold text-[#1E3A8A] mb-1">
                      <span>{brief.sectionLabelTelugu}</span>
                      <span className="px-1.5 py-0.2 bg-blue-50 text-blue-900">
                        {brief.locationDatelineTelugu}
                      </span>
                    </div>
                    <h3 className="font-telugu-sans font-extrabold text-[14px] leading-snug text-[#111111] mb-1">
                      <span className="text-[#B91C1C] mr-1">{bIdx + 1}.</span>
                      {brief.headlineTextTelugu}
                    </h3>
                    <p className="font-telugu-serif text-[12.5px] leading-relaxed text-stone-800 text-justify">
                      {brief.bodyParagraphsTelugu.join(' ')}
                    </p>
                  </div>
                ))}

                {/* Today's Key Numbers Infographic Card (ఈనాటి ముఖ్య గణాంకాలు) */}
                <div className="bg-[#FFFBEB] border border-[#D97706] p-2.5 font-telugu-sans">
                  <div className="bg-[#B45309] text-white font-extrabold text-[11px] px-2 py-1 mb-2 text-center">
                    ఈనాటి ముఖ్య గణాంకాలు
                  </div>
                  <div className="space-y-1.5 text-[11.5px]">
                    <div className="flex justify-between border-b border-amber-200 pb-1">
                      <span className="font-semibold text-stone-800">కృష్ణా డెల్టా ఆయకట్టు:</span>
                      <strong className="text-[#991B1B]">13.08 లక్షల ఎకరాలు</strong>
                    </div>
                    <div className="flex justify-between border-b border-amber-200 pb-1">
                      <span className="font-semibold text-stone-800">ధాన్యం కేంద్రాలు:</span>
                      <strong className="text-[#065F46]">142 కేంద్రాలు</strong>
                    </div>
                    <div className="flex justify-between border-b border-amber-200 pb-1">
                      <span className="font-semibold text-stone-800">కొత్త ఇ-బస్సులు:</span>
                      <strong className="text-[#1E40AF]">120 సర్వీసులు</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-stone-800">ఐటీ పెట్టుబడులు:</span>
                      <strong className="text-[#78350F]">రూ. 1,850 కోట్లు</strong>
                    </div>
                  </div>
                </div>

                {/* Editorial Integrity & Reader Notice Box */}
                <div className="mt-auto border border-stone-400 bg-[#FAF8F3] p-2.5 font-telugu-sans text-[11px] leading-relaxed text-stone-700">
                  <div className="font-extrabold text-[#991B1B] border-b border-stone-300 pb-1 mb-1">
                    పాఠకులకు ముఖ్య సూచన
                  </div>
                  ఈ సంచికలోని వార్తలు విలేకరుల నివేదికల ఆధారంగా ఏఐ సంపాదకీయ ప్రమాణాలతో ధృవీకరించబడి ముద్రించబడ్డాయి.
                </div>
              </aside>
            )}
          </div>

          {/* ============================================================== */}
          {/* GEOMETRIC MEDALLION & SHAPED CUTOUT SHOWCASE RIBBON            */}
          {/* ============================================================== */}
          <BroadsheetGeometricMedallionShowcase
            modules={allModulesAcrossPages}
            onSelectModule={(m) => setActiveClippedModule(m)}
          />
        </div>

        {/* Newspaper Page Footer */}
        <footer className="border-t-2 border-stone-900 pt-2 mt-6 flex flex-wrap items-center justify-between text-[11px] font-telugu-sans text-stone-800 font-medium">
          <span>
            {edition.mastheadTitleTelugu} దినపత్రిక · ముద్రణ: విజయవాడ ప్రధాన కార్యాలయం · Plan v
            {edition.masterPlan?.plan_version || 1}
          </span>
          <span className="text-[#991B1B] font-bold">
            వార్తపై క్లిక్ చేస్తే e-Paper రీడర్ మరియు లైవ్ లేఅవుట్ కస్టమైజర్ తెరుచుకుంటుంది
          </span>
          <span className="font-extrabold text-stone-900 font-mono-tabular">
            పేజీ {pageManifest.pageNumber} / {edition.actualPageCount}
          </span>
        </footer>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* ==================================================================== */}
      {/* INTERACTIVE E-PAPER & DESIGNER+EDITOR CONTROL RIBBON                 */}
      {/* ==================================================================== */}
      <div className="bg-white border border-stone-300 p-3 space-y-2.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <label
              htmlFor="edition-select"
              className="text-xs font-semibold text-stone-700 whitespace-nowrap"
            >
              సంచిక (Edition):
            </label>
            <select
              id="edition-select"
              value={edition.id}
              onChange={(e) => onSelectEdition(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-medium bg-stone-50 border border-stone-300 text-stone-900 focus:outline-none focus:border-stone-900"
            >
              {editions.map((ed) => (
                <option key={ed.id} value={ed.id}>
                  #{ed.editionNumber} · {ed.editionDate} — {ed.editionTitleTelugu} (Plan v
                  {ed.masterPlan?.plan_version || 1})
                </option>
              ))}
            </select>

            {/* Page Navigation Tabs */}
            <div className="flex items-center border border-stone-300 bg-stone-50">
              <button
                type="button"
                aria-label="Previous Page"
                disabled={activePageNumber <= 1 || spreadMode === 'dual_spread'}
                onClick={() => setActivePageNumber((p) => Math.max(1, p - 1))}
                className="p-1.5 text-stone-700 hover:bg-stone-200 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {edition.pages.map((p) => (
                <button
                  key={p.pageNumber}
                  type="button"
                  onClick={() => {
                    setSpreadMode('single');
                    setActivePageNumber(p.pageNumber);
                  }}
                  className={`px-3 py-1.5 text-xs font-telugu-sans font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    spreadMode === 'single' && activePageNumber === p.pageNumber
                      ? 'bg-[#991B1B] text-white'
                      : 'text-stone-800 hover:bg-stone-200'
                  }`}
                >
                  పేజీ {p.pageNumber} ({p.modules.length + p.sideBriefs.length} వార్తలు)
                </button>
              ))}
              <button
                type="button"
                aria-label="Next Page"
                disabled={
                  activePageNumber >= edition.pages.length || spreadMode === 'dual_spread'
                }
                onClick={() =>
                  setActivePageNumber((p) => Math.min(edition.pages.length, p + 1))
                }
                className="p-1.5 text-stone-700 hover:bg-stone-200 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* 1-Page vs 2-Page Spread Toggle */}
            {edition.pages.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setSpreadMode((m) => (m === 'single' ? 'dual_spread' : 'single'))
                }
                className={`px-2.5 py-1.5 text-xs font-medium border flex items-center gap-1.5 cursor-pointer transition-colors ${
                  spreadMode === 'dual_spread'
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-stone-50 text-stone-700 border-stone-300 hover:bg-stone-100'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                {spreadMode === 'dual_spread' ? 'Single Page View' : '2-Page Spread View'}
              </button>
            )}

            {/* Zoom Controls */}
            {spreadMode === 'single' && (
              <div className="flex items-center gap-1 border border-stone-300 bg-stone-50 px-2 py-1">
                <button
                  type="button"
                  aria-label="Zoom Out"
                  onClick={() => setZoomPercent((z) => Math.max(75, z - 10))}
                  className="p-1 text-stone-700 hover:text-stone-900 cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono-tabular text-xs text-stone-800 px-1">
                  {zoomPercent}%
                </span>
                <button
                  type="button"
                  aria-label="Zoom In"
                  onClick={() => setZoomPercent((z) => Math.min(125, z + 10))}
                  className="p-1 text-stone-700 hover:text-stone-900 cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Right Actions: Designer+Editor Inspector, Coordinate Overlay, Preflight, Rebuild, PDF */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDesignerEditorPanel((v) => !v)}
              className={`px-3 py-1.5 text-xs font-medium border flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                showDesignerEditorPanel
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Designer + Editor Plan (v{edition.masterPlan?.plan_version || 1})
            </button>

            <button
              type="button"
              onClick={() => setShowDiagnosticsOverlay((v) => !v)}
              className={`px-3 py-1.5 text-xs font-medium border flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                showDiagnosticsOverlay
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Coordinate Overlay
            </button>

            <button
              type="button"
              onClick={() => setShowPreflightPanel((v) => !v)}
              className={`px-3 py-1.5 text-xs font-medium border flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                showPreflightPanel
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              Preflight (
              {edition.preflightReport?.checks.filter((c) => c.passed).length || 11}/
              {edition.preflightReport?.checks.length || 11})
            </button>

            <button
              type="button"
              disabled={isGenerating}
              onClick={() => onRegenerateEdition(edition.id)}
              className="px-3 py-1.5 text-xs font-medium bg-stone-100 text-stone-800 border border-stone-300 hover:bg-stone-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              Run Designer+Editor Loop
            </button>

            <button
              type="button"
              disabled={isVerifyingAgentPdf}
              onClick={handleRunAgenticPdfVerify}
              className="px-3 py-1.5 text-xs font-bold bg-stone-900 text-amber-300 border border-stone-900 hover:bg-stone-800 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isVerifyingAgentPdf ? 'animate-spin' : ''}`} />
              {isVerifyingAgentPdf
                ? '3.1 → 3.5 Agents Auditing...'
                : 'Make PDF & Verify (3.1 → 3.5 Agent)'}
            </button>

            <button
              type="button"
              disabled={isDownloadingPdf}
              onClick={handleDownloadPrintPdf}
              className="px-3.5 py-1.5 text-xs font-semibold bg-[#991B1B] text-white hover:bg-[#7F1D1D] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-60"
            >
              <Download className={`w-3.5 h-3.5 ${isDownloadingPdf ? 'animate-bounce' : ''}`} />
              {isDownloadingPdf ? 'Preparing PDF...' : 'Download Print PDF'}
            </button>
          </div>
        </div>

        {/* Multi-Agent PDF Release Gatekeeper & Architect Status Banner */}
        {edition.agenticPdfReport && (
          <div className="bg-emerald-950 text-white px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs border-l-4 border-amber-400">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-400 text-stone-950 font-mono-tabular text-[10.5px] font-extrabold uppercase">
                {edition.agenticPdfReport.ready_for_user
                  ? 'READY FOR USER · SLIDE APPROVED'
                  : edition.agenticPdfReport.final_verdict}
              </span>
              <span className="font-mono-tabular text-[11px] text-emerald-200">
                Gatekeeper: <strong>{edition.agenticPdfReport.inspector_model_id}</strong> &lt;-&gt; Architect:{' '}
                <strong>{edition.agenticPdfReport.architect_model_id}</strong> ·{' '}
                {edition.agenticPdfReport.total_agent_rounds} Agent Round(s) · Quality Score:{' '}
                <strong>{edition.agenticPdfReport.final_quality_score}/100</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={handleRunAgenticPdfVerify}
              className="text-[11px] font-mono-tabular font-bold text-amber-300 hover:underline cursor-pointer"
            >
              Inspect 3.1 → 3.5 Agent Audit &amp; Print PDF →
            </button>
          </div>
        )}

        {/* Interactive e-Paper Section Spotlight Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-200">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-telugu-sans font-bold text-stone-600 mr-1">
              విభాగాల వారీగా వార్తలు (e-Paper Section Filter):
            </span>
            <button
              type="button"
              onClick={() => handleCategorySpotlight('all')}
              className={`px-2.5 py-1 text-xs font-telugu-sans font-bold cursor-pointer transition-colors ${
                spotlightCategory === 'all'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              అన్నీ ({allModulesAcrossPages.length})
            </button>
            {availableCategories.map(([catEng, catTel]) => (
              <button
                key={catEng}
                type="button"
                onClick={() => handleCategorySpotlight(catEng)}
                className={`px-2.5 py-1 text-xs font-telugu-sans font-bold cursor-pointer transition-colors ${
                  spotlightCategory === catEng
                    ? 'bg-[#991B1B] text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {catTel}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-stone-600 font-telugu-sans flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#991B1B] shrink-0" />
            <span>
              పేపర్‌పై ఏ వార్త మీదైనా క్లిక్ చేసి <strong>e-Paper Clipping Reader</strong> &amp;{' '}
              <strong>Live Box Style</strong> మార్చండి
            </span>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* DESIGNER + EDITOR MASTER LAYOUT PLAN & FEEDBACK LOOP INSPECTOR       */}
      {/* ==================================================================== */}
      {showDesignerEditorPanel && inspectedPlan && inspectedDiagnostics && (
        <div className="bg-white border border-stone-300 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-[#9A3412] text-white font-mono-tabular text-[11px] font-semibold">
                  DESIGNER (THE MIND) + EDITOR (THE HANDS)
                </span>
                <h3 className="text-sm font-semibold text-stone-900">
                  Master Layout Plan &amp; Deterministic Editor Feedback Loop
                </h3>
              </div>
              <p className="text-xs text-stone-600 mt-1">
                Designer Model:{' '}
                <span className="font-mono-tabular font-medium">
                  {inspectedPlan.designer_model_id}
                </span>{' '}
                · Coordinate System:{' '}
                <span className="font-mono-tabular">
                  {inspectedPlan.coordinate_system.unit} (
                  {inspectedPlan.coordinate_system.origin})
                </span>{' '}
                · Elements Rendered:{' '}
                <span className="font-mono-tabular font-semibold">
                  {inspectedDiagnostics.total_elements_rendered}
                </span>
              </p>
            </div>

            {/* Plan Version History Switcher */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-stone-600 flex items-center gap-1">
                <GitCompare className="w-3.5 h-3.5" /> Plan Version History:
              </span>
              {planHistory.map((h) => (
                <button
                  key={h.plan_version}
                  type="button"
                  onClick={() => setSelectedPlanVersion(h.plan_version)}
                  className={`px-2.5 py-1 text-xs font-mono-tabular border cursor-pointer transition-colors ${
                    inspectedPlan.plan_version === h.plan_version
                      ? 'bg-stone-900 text-white border-stone-900 font-semibold'
                      : 'bg-stone-50 text-stone-700 border-stone-300 hover:bg-stone-100'
                  }`}
                >
                  v{h.plan_version} (
                  {h.editor_diagnostics.status === 'valid'
                    ? 'VALID'
                    : `${h.editor_diagnostics.issues.length} ERR`}
                  )
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowRawPlanJson((v) => !v)}
                className="px-2.5 py-1 text-xs font-mono-tabular bg-stone-100 text-stone-800 border border-stone-300 hover:bg-stone-200 flex items-center gap-1 cursor-pointer"
              >
                <Code2 className="w-3.5 h-3.5" />
                {showRawPlanJson ? 'Hide Master JSON' : 'Inspect Raw JSON'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 border border-stone-200 bg-stone-50/70 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Component 1: Designer Master Plan (v{inspectedPlan.plan_version})
                </span>
                <span className="text-[11px] font-mono-tabular text-stone-500">
                  Page {activePageNumber}: {inspectedPagePlan?.elements.length || 0} atomic
                  elements
                </span>
              </div>
              <p className="text-xs text-stone-800 leading-relaxed">
                {inspectedPlan.design_rationale}
              </p>

              {inspectedPagePlan && (
                <div className="overflow-x-auto max-h-48 border border-stone-200 bg-white mt-2">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-100 text-stone-600 font-mono-tabular">
                        <th className="py-1.5 px-2">element_id</th>
                        <th className="py-1.5 px-2">type</th>
                        <th className="py-1.5 px-2">x, y (mm)</th>
                        <th className="py-1.5 px-2">w × h (mm)</th>
                        <th className="py-1.5 px-2">measured_h</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 font-mono-tabular">
                      {inspectedPagePlan.elements.map((el) => {
                        const meas =
                          inspectedDiagnostics.element_measurements?.[el.element_id];
                        const hasIssue = inspectedDiagnostics.issues.some(
                          (i) => i.element_id === el.element_id
                        );
                        return (
                          <tr
                            key={el.element_id}
                            className={
                              hasIssue ? 'bg-amber-50/90 text-amber-900' : 'text-stone-800'
                            }
                          >
                            <td className="py-1 px-2 font-medium">{el.element_id}</td>
                            <td className="py-1 px-2 text-stone-600">{el.type}</td>
                            <td className="py-1 px-2">
                              {el.geometry.x}, {el.geometry.y}
                            </td>
                            <td className="py-1 px-2">
                              {el.geometry.width} × {el.geometry.height}
                            </td>
                            <td className="py-1 px-2">
                              {meas ? `${meas.measured_height_mm}mm` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 border border-stone-200 bg-stone-50/70 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Component 2: Editor Diagnostics Report
                </span>
                <span
                  className={`px-2 py-0.5 text-[11px] font-mono-tabular font-semibold ${
                    inspectedDiagnostics.status === 'valid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  status: {inspectedDiagnostics.status}
                </span>
              </div>

              {inspectedDiagnostics.issues.length === 0 ? (
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" /> Zero Unresolved
                    Layout Errors
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Every Telugu headline, standfirst, multi-column body block, photograph,
                    and caption fits within its allocated physical coordinate box (
                    {inspectedPlan.coordinate_system.unit}) with zero overlaps.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {inspectedDiagnostics.issues.map((iss, idx) => (
                    <div
                      key={`${iss.element_id}-${idx}`}
                      className="p-2.5 bg-amber-50 border border-amber-300 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-mono-tabular font-semibold text-amber-900">
                        <span>
                          [{iss.type}] {iss.element_id} (Page {iss.page_number})
                        </span>
                        <span>
                          req: {iss.required_height_mm}mm / alloc: {iss.allocated_height_mm}
                          mm
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800">{iss.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {showRawPlanJson && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-stone-200">
              <div>
                <div className="text-xs font-mono-tabular font-semibold text-stone-700 mb-1">
                  Designer MasterLayoutPlan JSON (v{inspectedPlan.plan_version})
                </div>
                <pre className="p-3 bg-stone-900 text-stone-100 font-mono-tabular text-[11px] max-h-64 overflow-auto">
                  {JSON.stringify(inspectedPlan, null, 2)}
                </pre>
              </div>
              <div>
                <div className="text-xs font-mono-tabular font-semibold text-stone-700 mb-1">
                  EditorDiagnosticsReport JSON (v{inspectedDiagnostics.plan_version})
                </div>
                <pre className="p-3 bg-stone-900 text-stone-100 font-mono-tabular text-[11px] max-h-64 overflow-auto">
                  {JSON.stringify(inspectedDiagnostics, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collapsible 11-Point Print Preflight Verification Panel */}
      {showPreflightPanel && edition.preflightReport && (
        <div className="bg-white border border-stone-300 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
            <div>
              <h3 className="text-sm font-semibold text-stone-900">
                Print-Ready PDF Preflight Report — Edition #{edition.editionNumber}
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Profile: {edition.preflightReport.profile} · PDF Size:{' '}
                {(edition.preflightReport.pdfSizeBytes / 1024).toFixed(1)} KB · Pages:{' '}
                {edition.preflightReport.pageCount}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              {edition.preflightReport.overallPassed ? (
                <span className="text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> All Critical Preflight Checks Passed
                </span>
              ) : (
                <span className="text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> Preflight Warnings Detected
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {edition.preflightReport.checks.map((chk) => (
              <div
                key={chk.id}
                className="p-2.5 border border-stone-200 bg-stone-50/70 flex items-start gap-2"
              >
                {chk.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <div className="font-semibold text-stone-900">{chk.label}</div>
                  <div className="text-stone-600 mt-0.5 leading-snug">{chk.details}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* RENDERED TELUGU NEWSPAPER BROADSHEET CANVAS (1-PAGE OR 2-PAGE SPREAD)*/}
      {/* ==================================================================== */}
      <div ref={pageContainerRef} className="overflow-x-auto pb-8">
        {spreadMode === 'dual_spread' ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            {edition.pages.map((p) => renderBroadsheetPageSheet(p))}
          </div>
        ) : (
          <div className="flex justify-center">
            {currentPage && renderBroadsheetPageSheet(currentPage)}
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* INTERACTIVE E-PAPER STORY CLIPPING READER & LIVE LAYOUT STUDIO MODAL */}
      {/* ==================================================================== */}
      {activeClippedModule && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Interactive e-Paper Story Reader and Live Layout Customizer"
          className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setActiveClippedModule(null)}
        >
          <div
            className="bg-[#FAF8F3] border-2 border-stone-900 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Newspaper Clipping Header */}
            <div className="bg-[#18181B] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#B91C1C]">
              <div className="flex items-center gap-2.5">
                <span className="px-2 py-0.5 bg-[#B91C1C] text-white font-telugu-sans text-xs font-extrabold">
                  {activeClippedModule.sectionLabelTelugu}
                </span>
                <span className="font-telugu-sans text-xs text-amber-300 font-bold">
                  {edition.mastheadTitleTelugu} e-Paper క్లిప్పింగ్ · పేజీ{' '}
                  {activeClippedModule.pageNumber} · {activeClippedModule.locationDatelineTelugu}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Font Size Controls */}
                <div className="flex items-center border border-stone-600 bg-stone-800 px-1.5 py-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setReaderFontScale((s) => Math.max(0.85, s - 0.1))}
                    className="px-1.5 text-stone-300 hover:text-white cursor-pointer"
                  >
                    A-
                  </button>
                  <span className="px-1 text-stone-400">|</span>
                  <button
                    type="button"
                    onClick={() => setReaderFontScale(1)}
                    className="px-1.5 text-stone-300 hover:text-white cursor-pointer"
                  >
                    A
                  </button>
                  <span className="px-1 text-stone-400">|</span>
                  <button
                    type="button"
                    onClick={() => setReaderFontScale((s) => Math.min(1.35, s + 0.1))}
                    className="px-1.5 text-stone-300 hover:text-white cursor-pointer"
                  >
                    A+
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const artId = activeClippedModule.articleId;
                    setActiveClippedModule(null);
                    onSelectArticle(artId);
                  }}
                  className="px-3 py-1 bg-amber-500 text-stone-950 font-semibold text-xs hover:bg-amber-400 flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Inspect AI Pipeline &amp; Edit Text
                </button>

                <button
                  type="button"
                  aria-label="Close e-Paper Reader"
                  onClick={() => setActiveClippedModule(null)}
                  className="p-1 text-stone-300 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12">
              {/* Left 8 Cols: High-Contrast Telugu e-Paper Clipping View */}
              <div className="lg:col-span-8 p-6 border-b lg:border-b-0 lg:border-r border-stone-300 space-y-4">
                {SUPER_KICKERS_BY_ARTICLE[activeClippedModule.articleId] && (
                  <div className="font-telugu-sans text-xs font-extrabold text-[#991B1B] tracking-wide">
                    {SUPER_KICKERS_BY_ARTICLE[activeClippedModule.articleId]}
                  </div>
                )}

                <h2
                  className="font-telugu-sans font-extrabold text-[#111111] leading-[1.28]"
                  style={{ fontSize: `${Math.round(26 * readerFontScale)}px` }}
                >
                  {activeClippedModule.headlineTextTelugu}
                </h2>

                {activeClippedModule.standfirstTextTelugu && (
                  <div className="bg-[#FEF3C7] border-l-4 border-[#B45309] p-3 font-telugu-sans font-bold text-sm text-[#78350F]">
                    {activeClippedModule.standfirstTextTelugu}
                  </div>
                )}

                <div className="border border-stone-400 overflow-hidden bg-stone-900">
                  <EditorialPhotoIllustration
                    articleId={activeClippedModule.articleId}
                    category={activeClippedModule.sectionCategory}
                    imageUrl={activeClippedModule.photographUrl}
                    altText={
                      activeClippedModule.photographCaptionTelugu ||
                      activeClippedModule.headlineTextTelugu
                    }
                    locationTelugu={activeClippedModule.locationDatelineTelugu}
                    heightClass="h-60"
                  />
                  {activeClippedModule.photographCaptionTelugu && (
                    <div className="bg-[#1C1917] text-stone-100 px-3 py-2 font-telugu-sans text-xs">
                      <span className="text-amber-300 font-bold mr-1">చిత్రం:</span>
                      {activeClippedModule.photographCaptionTelugu}
                    </div>
                  )}
                </div>

                <div
                  className="font-telugu-serif text-[#18181B] space-y-3 text-justify leading-relaxed"
                  style={{ fontSize: `${Math.round(16 * readerFontScale)}px` }}
                >
                  {activeClippedModule.bodyParagraphsTelugu.map((para, idx) => (
                    <p key={idx}>
                      {idx === 0 && (
                        <strong className="font-telugu-sans font-extrabold text-[#991B1B] mr-1.5">
                          {activeClippedModule.locationDatelineTelugu} (ప్రజా వాణి బ్యూరో):
                        </strong>
                      )}
                      {idx === 0
                        ? para.replace(
                            new RegExp(
                              `^${activeClippedModule.locationDatelineTelugu.replace(
                                /[.*+?^${}()|[\]\\]/g,
                                '\\$&'
                              )}\\s*:\\s*`
                            ),
                            ''
                          )
                        : para}
                    </p>
                  ))}
                </div>
              </div>

              {/* Right 4 Cols: Live Broadsheet Module Layout Customizer */}
              <div className="lg:col-span-4 p-5 bg-[#F3EFE6] space-y-4">
                <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-stone-900 border-b border-stone-300 pb-2">
                  <Sliders className="w-4 h-4 text-[#991B1B]" />
                  Live Broadsheet Box Customizer
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Adjust how this article module is packaged on the broadsheet page. Changes
                  update the newspaper canvas and DOM measurements immediately.
                </p>

                {/* 1. Box Visual Style Preset */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-stone-800">
                    1. Eenadu Box Visual Style:
                  </label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {(
                      [
                        { id: 'auto', label: 'Auto (Designer Recommended)' },
                        { id: 'lead_crimson', label: 'Crimson Lead Banner Box' },
                        { id: 'cyan_box', label: 'Eenadu Royal Blue / Cyan Box' },
                        { id: 'saffron_panorama', label: 'Saffron Panorama Split Box' },
                        { id: 'emerald_box', label: 'Emerald Agriculture / Tech Box' },
                        { id: 'rose_anchor', label: 'Rose-Burgundy Feature Box' },
                        { id: 'classic_column', label: 'Classic Newsprint Column' },
                      ] as { id: BoxVisualTheme; label: string }[]
                    ).map((opt) => {
                      const currentTheme =
                        moduleOverrides[activeClippedModule.articleId]?.theme || 'auto';
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            updateModuleOverride(activeClippedModule.articleId, {
                              theme: opt.id,
                            })
                          }
                          className={`px-3 py-1.5 text-xs text-left font-medium border cursor-pointer transition-colors ${
                            currentTheme === opt.id
                              ? 'bg-stone-900 text-white border-stone-900'
                              : 'bg-white text-stone-800 border-stone-300 hover:bg-stone-100'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Non-Rectangular Geometric Shape & Text-Wrap Selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-stone-800">
                    2. Geometric Shape &amp; Text-Wrap Contour (Designer + Editor):
                  </label>
                  <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-1">
                    {(
                      [
                        { id: 'auto', label: 'Auto (Designer Assigned Shape)' },
                        {
                          id: 'circle',
                          label: 'Circle Area + Curved Text Wrap (వృత్తాకార బింబం)',
                        },
                        {
                          id: 'semi_circle_arch',
                          label: 'Part of Circle: Semi-Circle Dome (అర్ధ వృత్తాకార ఆర్చ్)',
                        },
                        {
                          id: 'quarter_circle_wedge',
                          label: 'Part of Circle: Quarter-Circle Wedge (కోణీయ వృత్త ఖండం)',
                        },
                        {
                          id: 'tomb_arch',
                          label: 'Tomb / Gopuram Arch Square (గోపుర ఆర్చ్ పెట్టె)',
                        },
                        {
                          id: 'rhombus_diamond',
                          label: 'Rhombus Diamond Square + Diagonal Wrap (వజ్రాకృతి)',
                        },
                        {
                          id: 'pentagon_shield',
                          label: 'Pentagon Shield + Angled Wrap (పంచభుజి షీల్డ్)',
                        },
                        {
                          id: 'hexagon_gem',
                          label: 'Hexagon Gem + Polygon Wrap (షడ్భుజి కోణం)',
                        },
                        {
                          id: 'star_burst',
                          label: '12-Point Starburst Medallion (నక్షత్ర ముద్ర)',
                        },
                        {
                          id: 'rectangle',
                          label: 'Classic Broadsheet Square/Rect (చతురస్ర పెట్టె)',
                        },
                      ] as { id: GeometricShapeType | 'auto'; label: string }[]
                    ).map((sOpt) => {
                      const currentShape =
                        moduleOverrides[activeClippedModule.articleId]?.shapeType || 'auto';
                      return (
                        <button
                          key={sOpt.id}
                          type="button"
                          onClick={() =>
                            updateModuleOverride(activeClippedModule.articleId, {
                              shapeType: sOpt.id,
                            })
                          }
                          className={`px-2.5 py-1.5 text-[11px] text-left font-medium border cursor-pointer transition-colors ${
                            currentShape === sOpt.id
                              ? 'bg-[#991B1B] text-white border-[#991B1B]'
                              : 'bg-white text-stone-800 border-stone-300 hover:bg-stone-100'
                          }`}
                        >
                          {sOpt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Column Span Selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-stone-800">
                    3. Column Width Span:
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[2, 3, 4, 5].map((span) => {
                      const currentSpan =
                        moduleOverrides[activeClippedModule.articleId]?.colSpan ||
                        activeClippedModule.gridColumnSpan;
                      return (
                        <button
                          key={span}
                          type="button"
                          onClick={() =>
                            updateModuleOverride(activeClippedModule.articleId, {
                              colSpan: span,
                            })
                          }
                          className={`py-1.5 text-xs font-mono-tabular font-semibold border cursor-pointer ${
                            currentSpan === span
                              ? 'bg-[#991B1B] text-white border-[#991B1B]'
                              : 'bg-white text-stone-800 border-stone-300 hover:bg-stone-100'
                          }`}
                        >
                          {span} Col
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Copy Length Variant */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-stone-800">
                    4. Telugu Copy Length (Gemini 3.5 Flash-Lite):
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['full', 'short'] as const).map((variant) => {
                      const currentVar =
                        moduleOverrides[activeClippedModule.articleId]?.bodyVariant ||
                        (activeClippedModule.bodyVariant === 'short' ? 'short' : 'full');
                      return (
                        <button
                          key={variant}
                          type="button"
                          onClick={() =>
                            updateModuleOverride(activeClippedModule.articleId, {
                              bodyVariant: variant,
                            })
                          }
                          className={`py-1.5 text-xs font-medium border cursor-pointer ${
                            currentVar === variant
                              ? 'bg-stone-900 text-white border-stone-900'
                              : 'bg-white text-stone-800 border-stone-300 hover:bg-stone-100'
                          }`}
                        >
                          {variant === 'full' ? 'Full Story' : 'Compact Summary'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Diamond Highlights Toggle */}
                <div className="pt-1">
                  <label className="flex items-center gap-2 text-xs font-semibold text-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        moduleOverrides[activeClippedModule.articleId]?.showHighlightsBox ??
                        true
                      }
                      onChange={(e) =>
                        updateModuleOverride(activeClippedModule.articleId, {
                          showHighlightsBox: e.target.checked,
                        })
                      }
                      className="accent-[#991B1B]"
                    />
                    Show Eenadu Diamond Highlights Box (ముఖ్యాంశాలు)
                  </label>
                </div>

                <div className="pt-3 border-t border-stone-300 flex items-center justify-between">
                  <span className="text-[11px] text-stone-600 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Live Editor Reflow Ready
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveClippedModule(null)}
                    className="px-3.5 py-1.5 bg-[#991B1B] text-white text-xs font-semibold hover:bg-[#7F1D1D] cursor-pointer"
                  >
                    Apply &amp; View Page
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cookie-Safe Print-Ready PDF Studio & Verification Modal */}
      <PdfExportInspectorModal
        payload={pdfInspectorPayload}
        error={pdfDownloadError}
        onReverifyAgentLoop={handleRunAgenticPdfVerify}
        isReverifying={isVerifyingAgentPdf}
        onClose={() => {
          setPdfInspectorPayload(null);
          setPdfDownloadError(null);
        }}
      />
    </div>
  );
};
