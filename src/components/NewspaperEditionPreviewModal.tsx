import React, { useState } from 'react';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  FileText,
  Newspaper,
  CheckCircle2,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import type { NewspaperEdition, PublicationSettings } from '../shared/types.ts';
import { fetchAndTriggerCookieSafePdfDownload } from './PdfExportInspectorModal.tsx';
import { useToast } from './ToastNotification.tsx';
import { EditorialPhotoIllustration } from './EditorialPhotoIllustration.tsx';

interface NewspaperEditionPreviewModalProps {
  edition: NewspaperEdition | null;
  settings: PublicationSettings;
  isOpen: boolean;
  onClose: () => void;
}

export const NewspaperEditionPreviewModal: React.FC<NewspaperEditionPreviewModalProps> = ({
  edition,
  settings,
  isOpen,
  onClose,
}) => {
  const { addToast } = useToast();
  const [activePage, setActivePage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'paper' | 'pdf'>('paper');
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  if (!isOpen || !edition) return null;

  const totalPages = edition.actualPageCount || edition.pages?.length || 1;
  const currentPageManifest = edition.pages?.find((p) => p.pageNumber === activePage) || edition.pages?.[0];

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    addToast({
      type: 'loading',
      title: 'పి.డి.ఎఫ్ డౌన్‌లోడ్ అవుతోంది...',
      message: `${edition.editionTitleTelugu} పత్రాన్ని సిద్ధం చేస్తోంది.`,
    });

    try {
      const payload = await fetchAndTriggerCookieSafePdfDownload(edition.id);
      addToast({
        type: 'success',
        title: 'డౌన్‌లోడ్ పూర్తయింది! 🗞️',
        message: `${payload.filename} విజయవంతంగా సేవ్ చేయబడింది.`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'డౌన్‌లోడ్ విఫలమైంది',
        message: err.message || 'పి.డి.ఎఫ్ ఫైల్ అందుబాటులో లేదు.',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-between overflow-hidden">
      {/* Top Navigation Bar */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3 text-white">
        {/* Left: Newspaper Title & Metadata */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-red-600 flex items-center justify-center text-white shadow-lg shadow-rose-950/60 font-black">
            <Newspaper className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black font-telugu-sans tracking-tight">
                {edition.editionTitleTelugu}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800 text-[10px] text-emerald-300 font-bold">
                ముద్రణకు సిద్ధం
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              సంచిక #{edition.editionNumber} · {edition.editionDate} · {totalPages} పేజీలు
            </p>
          </div>
        </div>

        {/* Center: View Switcher & Page Navigator */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1">
          {/* Mode toggle */}
          <button
            type="button"
            onClick={() => setViewMode('paper')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'paper'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Newspaper className="w-3.5 h-3.5" />
            <span>ఈ-పేపర్ వ్యూ</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('pdf')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'pdf'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>పి.డి.ఎఫ్ వ్యూ</span>
          </button>

          {/* Page Switcher for multi-page editions */}
          {totalPages > 1 && viewMode === 'paper' && (
            <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
              <button
                type="button"
                disabled={activePage <= 1}
                onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                title="మునుపటి పేజీ"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-bold px-1.5">
                పేజీ {activePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={activePage >= totalPages}
                onClick={() => setActivePage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                title="తర్వాతి పేజీ"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Right: Zoom, Download & Close */}
        <div className="flex items-center gap-2">
          {viewMode === 'paper' && (
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl px-2 py-1">
              <button
                type="button"
                onClick={() => setZoomPercent((z) => Math.max(60, z - 15))}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
                title="జూమ్ తగ్గించండి"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono font-bold text-slate-300 px-1">
                {zoomPercent}%
              </span>
              <button
                type="button"
                onClick={() => setZoomPercent((z) => Math.min(160, z + 15))}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
                title="జూమ్ పెంచండి"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            disabled={isDownloading}
            onClick={handleDownloadPdf}
            className="px-3.5 py-1.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isDownloading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>పి.డి.ఎఫ్ డౌన్‌లోడ్</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 cursor-pointer ml-2"
            title="మూసివేయండి"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start bg-stone-900/60">
        {viewMode === 'pdf' ? (
          /* PDF IFrame View */
          <div className="w-full max-w-5xl h-[85vh] bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
            <iframe
              src={`/api/editions/${edition.id}/pdf`}
              title="Newspaper Edition PDF"
              className="w-full h-full border-0"
            />
          </div>
        ) : (
          /* e-Paper Rendered Layout View */
          <div
            style={{
              width: `${Math.round(1080 * (zoomPercent / 100))}px`,
              minHeight: `${Math.round(1440 * (zoomPercent / 100))}px`,
              transformOrigin: 'top center',
            }}
            className="broadsheet-page bg-[#FAF8F3] text-stone-900 p-6 sm:p-8 shadow-2xl rounded-sm border-2 border-stone-400 transition-all duration-150 flex flex-col justify-between"
          >
            {/* Top Newspaper Masthead (Page 1 only) */}
            {activePage === 1 ? (
              <header className="mb-4">
                {/* Skyline Ribbon */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2 pb-2 border-b-2 border-stone-800">
                  <div className="bg-[#FFFBEB] border border-[#D97706] px-2.5 py-1 text-xs">
                    <span className="bg-[#B45309] text-white font-bold px-1 rounded text-[10px] mr-1">
                      ప్రత్యేకం
                    </span>
                    <strong className="text-stone-900 font-telugu-sans">
                      విజయవాడ అమరావతి అభివృద్ధి పనుల వేగం
                    </strong>
                  </div>
                  <div className="bg-[#EFF6FF] border border-[#1D4ED8] px-2.5 py-1 text-xs">
                    <span className="bg-[#1E40AF] text-white font-bold px-1 rounded text-[10px] mr-1">
                      రైతు లోకం
                    </span>
                    <strong className="text-stone-900 font-telugu-sans">
                      కృష్ణా డెల్టా కాలువలకు సాగునీటి విడుదల
                    </strong>
                  </div>
                  <div className="bg-[#FFF1F2] border border-[#BE123C] px-2.5 py-1 text-xs">
                    <span className="bg-[#9F1239] text-white font-bold px-1 rounded text-[10px] mr-1">
                      తాజా
                    </span>
                    <strong className="text-stone-900 font-telugu-sans">
                      రాష్ట్రవ్యాప్త సమగ్ర వార్తా నివేదికలు
                    </strong>
                  </div>
                </div>

                {/* Masthead Centerpiece */}
                <div className="text-center py-2 border-b-4 border-double border-stone-900 relative">
                  <h1 className="text-5xl sm:text-6xl font-black font-telugu-serif tracking-tight text-[#991B1B]">
                    {settings.newspaperNameTelugu || 'ప్రజా వాణి'}
                  </h1>
                  <p className="text-xs font-serif italic text-stone-700 tracking-wider mt-1">
                    {settings.newspaperTaglineTelugu || 'ఆంధ్రప్రదేశ్ & తెలంగాణ సమగ్ర దినపత్రిక'}
                  </p>

                  <div className="flex items-center justify-between text-[11px] font-telugu-sans font-semibold border-t border-stone-400 mt-2 pt-1 text-stone-800">
                    <span>విజయవాడ ఎడిషన్</span>
                    <span>{edition.editionDate} · దినపత్రిక సంచిక #{edition.editionNumber}</span>
                    <span>వెల: ₹6.00 · పేజీలు: {totalPages}</span>
                  </div>
                </div>
              </header>
            ) : (
              /* Inside Page Folio */
              <div className="border-b-2 border-stone-800 pb-1 mb-4 flex items-center justify-between text-xs font-telugu-sans font-bold text-stone-800">
                <span>ప్రజా వాణి దినపత్రిక</span>
                <span>ఆంధ్రప్రదేశ్ &amp; తెలంగాణ ప్రాంతీయ వార్తలు</span>
                <span>పేజీ {activePage}</span>
              </div>
            )}

            {/* Page Stories Multi-Column Layout */}
            <div className="flex-1">
              {currentPageManifest?.modules && currentPageManifest.modules.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {currentPageManifest.modules.map((mod, idx) => (
                    <div
                      key={mod.moduleId || idx}
                      className={`p-3 border border-stone-300 rounded bg-white shadow-xs ${
                        mod.isLeadStory ? 'md:col-span-2 border-rose-300 bg-[#FFFDFD]' : ''
                      }`}
                    >
                      {mod.sectionLabelTelugu && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-stone-100 text-stone-700 mb-1 border border-stone-300">
                          {mod.sectionLabelTelugu}
                        </span>
                      )}

                      <h3
                        className={`font-black font-telugu-sans leading-tight mb-1.5 text-stone-950 ${
                          mod.isLeadStory ? 'text-xl sm:text-2xl text-[#991B1B]' : 'text-base sm:text-lg'
                        }`}
                      >
                        {mod.headlineTextTelugu}
                      </h3>

                      {mod.standfirstTextTelugu && (
                        <p className="text-xs font-semibold text-stone-700 font-telugu-sans mb-1.5 italic">
                          {mod.standfirstTextTelugu}
                        </p>
                      )}

                      {/* Photo if available */}
                      {mod.photographUrl && (
                        <div className="my-2 border border-stone-300 rounded overflow-hidden">
                          <EditorialPhotoIllustration
                            articleId={mod.articleId}
                            category={mod.sectionCategory}
                            imageUrl={mod.photographUrl}
                            altText={mod.photographCaptionTelugu || mod.headlineTextTelugu}
                            locationTelugu={mod.locationDatelineTelugu || 'విజయవాడ'}
                            heightClass="h-44"
                          />
                          {mod.photographCaptionTelugu && (
                            <p className="text-[10px] text-stone-600 bg-stone-100 px-2 py-1 italic font-telugu-sans border-t border-stone-200">
                              {mod.photographCaptionTelugu}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Dateline */}
                      {mod.locationDatelineTelugu && (
                        <div className="text-[11px] font-semibold text-stone-600 mb-1.5 pb-1 border-b border-stone-200">
                          <span className="font-bold text-stone-900 mr-1.5">
                            {mod.locationDatelineTelugu} :
                          </span>
                        </div>
                      )}

                      {/* Body Paragraphs */}
                      <div className="text-xs font-telugu-sans text-stone-800 leading-relaxed space-y-1.5">
                        {Array.isArray(mod.bodyParagraphsTelugu)
                          ? mod.bodyParagraphsTelugu.slice(0, 3).map((p: string, pIdx: number) => (
                              <p key={pIdx}>{p}</p>
                            ))
                          : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center text-stone-500 font-telugu-sans">
                  ఈ పేజీలో కథనాలు అమర్చబడుతున్నాయి...
                </div>
              )}
            </div>

            {/* Bottom Folio / Footer */}
            <footer className="mt-6 pt-2 border-t-2 border-stone-800 flex items-center justify-between text-[11px] font-telugu-sans font-semibold text-stone-700">
              <span>ప్రజా వాణి దినపత్రిక · సర్వహక్కులు ప్రత్యేకించబడ్డాయి</span>
              <span>ముద్రణ మరియు ప్రచురణ: ప్రజా వాణి మీడియా విజయవాడ</span>
              <span>పేజీ {activePage}</span>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
};
