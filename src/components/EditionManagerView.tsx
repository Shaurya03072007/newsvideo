import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  FilePlus2,
  Layers,
  RefreshCw,
  Settings,
  Shield,
} from 'lucide-react';
import type {
  AIProcessingJob,
  Article,
  NewspaperEdition,
  PublicationSettings,
} from '../shared/types.ts';
import {
  fetchAndTriggerCookieSafePdfDownload,
  PdfExportInspectorModal,
  type PdfDownloadPayload,
} from './PdfExportInspectorModal.tsx';

interface EditionManagerViewProps {
  editions: NewspaperEdition[];
  articles: Article[];
  jobs: AIProcessingJob[];
  settings: PublicationSettings;
  onCreateEdition: (payload: {
    editionDate: string;
    editionTitleTelugu: string;
    targetPageCount: number;
    columnsPerPage: number;
  }) => Promise<void>;
  onRegenerateEdition: (editionId: string) => Promise<void>;
  onOpenPreview: (editionId: string) => void;
  onUpdateSettings: (partial: Partial<PublicationSettings>) => Promise<void>;
}

export const EditionManagerView: React.FC<EditionManagerViewProps> = ({
  editions,
  articles,
  jobs,
  settings,
  onCreateEdition,
  onRegenerateEdition,
  onOpenPreview,
  onUpdateSettings,
}) => {
  const [editionDate, setEditionDate] = useState('2026-10-19');
  const [editionTitleTelugu, setEditionTitleTelugu] = useState(
    'ప్రజా వాణి — సాయంత్రం ప్రత్యేక సంచిక (విజయవాడ · అమరావతి)'
  );
  const [targetPageCount, setTargetPageCount] = useState(2);
  const [columnsPerPage, setColumnsPerPage] = useState(6);
  const [isCreating, setIsCreating] = useState(false);
  const [pdfInspectorPayload, setPdfInspectorPayload] = useState<PdfDownloadPayload | null>(null);
  const [pdfDownloadError, setPdfDownloadError] = useState<string | null>(null);

  const [mastheadName, setMastheadName] = useState(settings.newspaperNameTelugu);
  const [mastheadTagline, setMastheadTagline] = useState(settings.newspaperTaglineTelugu);
  const [pressProfile, setPressProfile] = useState(settings.pressPreflightProfile);
  const [holdHighRisk, setHoldHighRisk] = useState(settings.autoHoldHighRiskStories);
  const [holdAllegations, setHoldAllegations] = useState(settings.autoHoldSeriousAllegations);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await onCreateEdition({
        editionDate,
        editionTitleTelugu,
        targetPageCount,
        columnsPerPage,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSavingSettings(true);
    try {
      await onUpdateSettings({
        newspaperNameTelugu: mastheadName,
        newspaperTaglineTelugu: mastheadTagline,
        pressPreflightProfile: pressProfile,
        autoHoldHighRiskStories: holdHighRisk,
        autoHoldSeriousAllegations: holdAllegations,
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 Cols: Create & Generate New Newspaper Edition */}
        <div className="lg:col-span-6 bg-white border border-stone-200 p-6 space-y-4">
          <div className="border-b border-stone-200 pb-3">
            <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2">
              <FilePlus2 className="w-4 h-4 text-[#9A3412]" />
              Plan & Generate New Telugu Newspaper Edition
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Enqueues background edition planner, deterministic 6-column broadsheet compositor, and Chromium PDF generator
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="new-ed-title" className="block text-xs font-medium text-stone-700 mb-1">
                Edition Title (సంచిక పేరు)
              </label>
              <input
                id="new-ed-title"
                type="text"
                value={editionTitleTelugu}
                onChange={(e) => setEditionTitleTelugu(e.target.value)}
                className="w-full px-3 py-2 text-sm font-telugu-sans bg-white border border-stone-300 text-stone-900"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="new-ed-date" className="block text-xs font-medium text-stone-700 mb-1">
                  Edition Date
                </label>
                <input
                  id="new-ed-date"
                  type="date"
                  value={editionDate}
                  onChange={(e) => setEditionDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-stone-300 text-stone-900"
                />
              </div>

              <div>
                <label htmlFor="new-ed-pages" className="block text-xs font-medium text-stone-700 mb-1">
                  Target Pages
                </label>
                <select
                  id="new-ed-pages"
                  value={targetPageCount}
                  onChange={(e) => setTargetPageCount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-stone-300 text-stone-900"
                >
                  <option value={1}>1 Page (Single Sheet)</option>
                  <option value={2}>2 Pages (Standard Broadsheet)</option>
                  <option value={3}>3 Pages (Extended Edition)</option>
                  <option value={4}>4 Pages (Full Pullout)</option>
                </select>
              </div>

              <div>
                <label htmlFor="new-ed-cols" className="block text-xs font-medium text-stone-700 mb-1">
                  Columns / Page
                </label>
                <select
                  id="new-ed-cols"
                  value={columnsPerPage}
                  onChange={(e) => setColumnsPerPage(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-stone-300 text-stone-900"
                >
                  <option value={5}>5 Columns</option>
                  <option value={6}>6 Columns (Standard Daily)</option>
                  <option value={7}>7 Columns (Dense Print)</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                disabled={isCreating}
                onClick={handleCreate}
                className="px-5 py-2 text-xs font-semibold bg-[#9A3412] text-white hover:bg-[#7C2D12] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Layers className="w-3.5 h-3.5" />
                {isCreating ? 'Enqueuing Edition Build Job...' : 'Generate New Edition & Print PDF'}
              </button>
            </div>
          </div>
        </div>

        {/* Right 6 Cols: Publication Masthead, Editorial Safety Policy & Print Profile */}
        <div className="lg:col-span-6 bg-white border border-stone-200 p-6 space-y-4">
          <div className="border-b border-stone-200 pb-3">
            <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2">
              <Settings className="w-4 h-4 text-stone-700" />
              Masthead, Editorial Hold Policy & Print Preflight Config
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Configure unattended publishing safety holds, newspaper masthead, and press preflight profile
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="cfg-masthead-name" className="block text-xs font-medium text-stone-700 mb-1">
                Newspaper Masthead Name (పత్రిక పేరు)
              </label>
              <input
                id="cfg-masthead-name"
                type="text"
                value={mastheadName}
                onChange={(e) => setMastheadName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm font-telugu-sans font-bold bg-stone-50 border border-stone-300 text-stone-900"
              />
            </div>

            <div>
              <label htmlFor="cfg-press-profile" className="block text-xs font-medium text-stone-700 mb-1">
                Print Preflight Profile
              </label>
              <select
                id="cfg-press-profile"
                value={pressProfile}
                onChange={(e) => setPressProfile(e.target.value as PublicationSettings['pressPreflightProfile'])}
                className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-300 text-stone-900"
              >
                <option value="standard_rgb_print">Standard Digital Broadsheet PDF</option>
                <option value="press_cmyk_bleed">Press Preflight (Crop Marks + 3mm Bleed)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="cfg-masthead-tagline" className="block text-xs font-medium text-stone-700 mb-1">
              Masthead Subtitle / Motto
            </label>
            <input
              id="cfg-masthead-tagline"
              type="text"
              value={mastheadTagline}
              onChange={(e) => setMastheadTagline(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-telugu-sans bg-stone-50 border border-stone-300 text-stone-900"
            />
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-xs text-stone-800 cursor-pointer">
              <input
                type="checkbox"
                checked={holdHighRisk}
                onChange={(e) => setHoldHighRisk(e.target.checked)}
                className="accent-[#9A3412]"
              />
              <span>
                <strong>Auto-Hold High-Risk Submissions</strong> (Prevent automatic placement until editor approval)
              </span>
            </label>

            <label className="flex items-center gap-2 text-xs text-stone-800 cursor-pointer">
              <input
                type="checkbox"
                checked={holdAllegations}
                onChange={(e) => setHoldAllegations(e.target.checked)}
                className="accent-[#9A3412]"
              />
              <span>
                <strong>Auto-Hold Unverified Serious Allegations</strong> (Enforce defamation & verification guard)
              </span>
            </label>
          </div>

          <div className="pt-1 flex justify-end">
            <button
              type="button"
              disabled={isSavingSettings}
              onClick={handleSaveConfig}
              className="px-4 py-1.5 text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Shield className="w-3.5 h-3.5" />
              {isSavingSettings ? 'Saving Policy...' : 'Save Editorial & Print Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* Editions History & Diagnostics Table */}
      <div className="bg-white border border-stone-200 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <h3 className="text-sm font-semibold text-stone-900">
            Generated Newspaper Editions ({editions.length})
          </h3>
          <span className="text-xs text-stone-500">
            Reproducible layout manifests & validated print PDFs
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 text-xs text-stone-500">
                <th className="py-2.5 px-3 font-medium">Edition</th>
                <th className="py-2.5 px-3 font-medium">Title (Telugu)</th>
                <th className="py-2.5 px-3 font-medium text-right">Pages</th>
                <th className="py-2.5 px-3 font-medium text-right">Placed / Held / Reflows</th>
                <th className="py-2.5 px-3 font-medium">Status & Preflight</th>
                <th className="py-2.5 px-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 text-xs">
              {editions.map((ed) => (
                <tr key={ed.id} className="hover:bg-stone-50/80">
                  <td className="py-3 px-3 font-mono-tabular font-semibold text-stone-900">
                    #{ed.editionNumber} · {ed.editionDate}
                  </td>
                  <td className="py-3 px-3 font-telugu-sans font-semibold text-stone-900">
                    {ed.editionTitleTelugu}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-tabular text-stone-700">
                    {ed.actualPageCount}p ({ed.columnsPerPage} cols)
                  </td>
                  <td className="py-3 px-3 text-right font-mono-tabular text-stone-700">
                    {ed.layoutDiagnostics.placedArticles || 0} placed ·{' '}
                    {ed.layoutDiagnostics.heldFlaggedArticlesSkipped || 0} held · Plan v
                    {ed.masterPlan?.plan_version || ed.layoutDiagnostics.finalPlanVersion || 1} (
                    {ed.planHistory?.length || ed.layoutDiagnostics.designerIterations || 1} iter)
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-mono-tabular uppercase font-semibold text-stone-800">
                      {ed.status}
                    </span>
                    <span className="text-emerald-700 ml-2 font-mono-tabular">
                      · Editor: {ed.editorDiagnostics?.status || 'valid'}
                    </span>
                    {ed.preflightReport?.overallPassed && (
                      <span className="text-emerald-700 ml-2">· 11/11 Preflight OK</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenPreview(ed.id)}
                        className="px-2.5 py-1 text-xs font-medium bg-stone-100 text-stone-800 border border-stone-300 hover:bg-stone-200 flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview Pages
                      </button>

                      <button
                        type="button"
                        onClick={() => onRegenerateEdition(ed.id)}
                        className="px-2.5 py-1 text-xs font-medium bg-white text-stone-700 border border-stone-300 hover:bg-stone-100 flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Rebuild
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const p = await fetchAndTriggerCookieSafePdfDownload(ed.id);
                            setPdfInspectorPayload(p);
                          } catch (e) {
                            setPdfDownloadError(e instanceof Error ? e.message : 'PDF download error');
                          }
                        }}
                        className="px-2.5 py-1 text-xs font-semibold bg-[#9A3412] text-white hover:bg-[#7C2D12] flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PdfExportInspectorModal
        payload={pdfInspectorPayload}
        error={pdfDownloadError}
        onClose={() => {
          setPdfInspectorPayload(null);
          setPdfDownloadError(null);
        }}
      />
    </div>
  );
};
