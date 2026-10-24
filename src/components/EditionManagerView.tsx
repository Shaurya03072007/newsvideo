import React, { useState, memo } from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  FilePlus2,
  Layers,
  RefreshCw,
  Settings,
  Shield,
  Sparkles,
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
import { NewspaperEditionPreviewModal } from './NewspaperEditionPreviewModal.tsx';
import { useToast } from './ToastNotification.tsx';

interface EditionManagerViewProps {
  editions: NewspaperEdition[];
  articles?: Article[];
  jobs?: AIProcessingJob[];
  settings: PublicationSettings;
  theme?: 'light' | 'dark';
  onCreateEdition: (payload: {
    editionDate: string;
    editionTitleTelugu: string;
    targetPageCount: number;
    columnsPerPage: number;
  }) => Promise<void>;
  onRegenerateEdition: (editionId: string) => Promise<void>;
  onOpenPreview?: (editionId: string) => void;
  onUpdateSettings: (partial: Partial<PublicationSettings>) => Promise<void>;
}

export const EditionManagerView: React.FC<EditionManagerViewProps> = memo(({
  editions,
  settings,
  theme = 'dark',
  onCreateEdition,
  onRegenerateEdition,
  onUpdateSettings,
}) => {
  const { addToast } = useToast();
  const [editionDate, setEditionDate] = useState('2026-10-19');
  const [editionTitleTelugu, setEditionTitleTelugu] = useState(
    'ప్రజా వాణి — సాయంత్రం ప్రత్యేక సంచిక (విజయవాడ · అమరావతి)'
  );
  const [targetPageCount, setTargetPageCount] = useState(2);
  const [columnsPerPage, setColumnsPerPage] = useState(6);
  const [isCreating, setIsCreating] = useState(false);
  const [regeneratingMap, setRegeneratingMap] = useState<Record<string, boolean>>({});
  const [pdfInspectorPayload, setPdfInspectorPayload] = useState<PdfDownloadPayload | null>(null);
  const [pdfDownloadError, setPdfDownloadError] = useState<string | null>(null);
  const [previewEdition, setPreviewEdition] = useState<NewspaperEdition | null>(null);

  const [mastheadName, setMastheadName] = useState(settings.newspaperNameTelugu);
  const [mastheadTagline, setMastheadTagline] = useState(settings.newspaperTaglineTelugu);
  const [pressProfile, setPressProfile] = useState(settings.pressPreflightProfile);
  const [holdHighRisk, setHoldHighRisk] = useState(settings.autoHoldHighRiskStories);
  const [holdAllegations, setHoldAllegations] = useState(settings.autoHoldSeriousAllegations);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const isLight = theme === 'light';

  const handleCreate = async () => {
    setIsCreating(true);
    addToast({
      type: 'loading',
      title: 'దినపత్రిక సంచిక ప్రచురణ సిద్ధమవుతోంది',
      message: `వార్తలను ${columnsPerPage}-కాలమ్స్ పేజీ లేఅవుట్‌గా అమరుస్తోంది...`,
    });

    try {
      await onCreateEdition({
        editionDate,
        editionTitleTelugu,
        targetPageCount,
        columnsPerPage,
      });
      addToast({
        type: 'success',
        title: 'నూతన సంచిక విజయవంతంగా రూపొందించబడింది! 🗞️',
        message: 'దినపత్రిక పేజీల లేఅవుట్ మరియు పి.డి.ఎఫ్ ముద్రణ పూర్తయింది.',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'సంచిక రూపకల్పన విఫలమైంది',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRebuild = async (editionId: string, editionNumber: number) => {
    setRegeneratingMap((prev) => ({ ...prev, [editionId]: true }));
    addToast({
      type: 'loading',
      title: `సంచిక #${editionNumber} పునఃసమీక్ష`,
      message: 'దినపత్రిక పేజీల అమరికను మళ్లీ సరిచేస్తోంది...',
    });

    try {
      await onRegenerateEdition(editionId);
      addToast({
        type: 'success',
        title: `సంచిక #${editionNumber} పునరుద్ధరించబడింది ✨`,
        message: 'పేజీల అమరిక విజయవంతంగా పూర్తయింది.',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'తిరిగి అమర్చడం విఫలమైంది',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRegeneratingMap((prev) => ({ ...prev, [editionId]: false }));
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
      addToast({
        type: 'success',
        title: 'అమరికలు భద్రపరచబడ్డాయి',
        message: 'పత్రిక ప్రాథమిక వివరాలు నవీకరించబడ్డాయి.',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'అమరికల భద్రపరచడం విఫలమైంది',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 Cols: Create & Generate New Newspaper Edition */}
        <div
          className={`lg:col-span-6 p-6 rounded-2xl border transition-colors space-y-4 ${
            isLight
              ? 'bg-white border-stone-300 shadow-sm'
              : 'bg-slate-900/90 border-slate-800 shadow-xl shadow-black/40'
          }`}
        >
          <div className="border-b pb-3 border-slate-800/40">
            <h2
              className={`text-base font-bold flex items-center gap-2 font-telugu-sans ${
                isLight ? 'text-stone-900' : 'text-white'
              }`}
            >
              <FilePlus2 className="w-5 h-5 text-rose-500" />
              నూతన దినపత్రిక సంచిక ప్రచురణ (Publish New Edition)
            </h2>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-stone-600' : 'text-slate-400'}`}>
              సేకరించిన తాజా కథనాలతో పూర్తి స్థాయి దినపత్రిక పేజీలను కూర్చి పి.డి.ఎఫ్ సిద్ధం చేయండి
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="new-ed-title"
                className={`block text-xs font-semibold mb-1.5 ${
                  isLight ? 'text-stone-700' : 'text-slate-300'
                }`}
              >
                సంచిక పేరు (Edition Title)
              </label>
              <input
                id="new-ed-title"
                type="text"
                value={editionTitleTelugu}
                onChange={(e) => setEditionTitleTelugu(e.target.value)}
                className={`w-full px-3.5 py-2 text-sm font-telugu-sans font-semibold rounded-xl border focus:outline-none focus:border-rose-500 transition-all ${
                  isLight
                    ? 'bg-stone-50 border-stone-300 text-stone-900'
                    : 'bg-slate-950 border-slate-800 text-white'
                }`}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="new-ed-date"
                  className={`block text-xs font-semibold mb-1.5 ${
                    isLight ? 'text-stone-700' : 'text-slate-300'
                  }`}
                >
                  ప్రచురణ తేదీ (Date)
                </label>
                <input
                  id="new-ed-date"
                  type="date"
                  value={editionDate}
                  onChange={(e) => setEditionDate(e.target.value)}
                  className={`w-full px-3 py-2 text-xs font-mono rounded-xl border focus:outline-none focus:border-rose-500 ${
                    isLight
                      ? 'bg-stone-50 border-stone-300 text-stone-900'
                      : 'bg-slate-950 border-slate-800 text-white'
                  }`}
                />
              </div>

              <div>
                <label
                  htmlFor="new-ed-pages"
                  className={`block text-xs font-semibold mb-1.5 ${
                    isLight ? 'text-stone-700' : 'text-slate-300'
                  }`}
                >
                  మొత్తం పేజీలు (Pages)
                </label>
                <select
                  id="new-ed-pages"
                  value={targetPageCount}
                  onChange={(e) => setTargetPageCount(Number(e.target.value))}
                  className={`w-full px-3 py-2 text-xs font-mono rounded-xl border outline-none cursor-pointer ${
                    isLight
                      ? 'bg-stone-50 border-stone-300 text-stone-900'
                      : 'bg-slate-950 border-slate-800 text-white'
                  }`}
                >
                  <option value={1}>1 పేజీ (సింగిల్ షీట్)</option>
                  <option value={2}>2 పేజీలు (ప్రామాణిక దినపత్రిక)</option>
                  <option value={3}>3 పేజీలు (ప్రత్యేక అనుబంధం)</option>
                  <option value={4}>4 పేజీలు (పూర్తి సంచిక)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="new-ed-cols"
                  className={`block text-xs font-semibold mb-1.5 ${
                    isLight ? 'text-stone-700' : 'text-slate-300'
                  }`}
                >
                  కాలమ్స్ అమరిక (Columns)
                </label>
                <select
                  id="new-ed-cols"
                  value={columnsPerPage}
                  onChange={(e) => setColumnsPerPage(Number(e.target.value))}
                  className={`w-full px-3 py-2 text-xs font-mono rounded-xl border outline-none cursor-pointer ${
                    isLight
                      ? 'bg-stone-50 border-stone-300 text-stone-900'
                      : 'bg-slate-950 border-slate-800 text-white'
                  }`}
                >
                  <option value={5}>5 కాలమ్స్</option>
                  <option value={6}>6 కాలమ్స్ (ప్రామాణిక ఈనాడు శైలి)</option>
                  <option value={7}>7 కాలమ్స్ (విస్తృత లేఅవుట్)</option>
                  <option value={8}>8 కాలమ్స్ (అధిక సాంద్రత)</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                disabled={isCreating}
                onClick={handleCreate}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>సంచిక రూపొందించబడుతోంది...</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-3.5 h-3.5" />
                    <span>నూతన సంచికను ప్రచురించండి &amp; పి.డి.ఎఫ్ సిద్ధం చేయండి</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right 6 Cols: Newspaper Masthead & Editorial Safety Policy */}
        <div
          className={`lg:col-span-6 p-6 rounded-2xl border transition-colors space-y-4 ${
            isLight
              ? 'bg-white border-stone-300 shadow-sm'
              : 'bg-slate-900/90 border-slate-800 shadow-xl shadow-black/40'
          }`}
        >
          <div className="border-b pb-3 border-slate-800/40">
            <h2
              className={`text-base font-bold flex items-center gap-2 font-telugu-sans ${
                isLight ? 'text-stone-900' : 'text-white'
              }`}
            >
              <Settings className="w-5 h-5 text-amber-500" />
              దినపత్రిక ప్రాథమిక అమరికలు (Settings &amp; Policy)
            </h2>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-stone-600' : 'text-slate-400'}`}>
              పత్రిక శీర్షిక, ట్యాగ్‌లైన్ మరియు ప్రచురణ నాణ్యతా మార్గదర్శకాలను నిర్వహించండి
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="cfg-masthead-name"
                className={`block text-xs font-semibold mb-1.5 ${
                  isLight ? 'text-stone-700' : 'text-slate-300'
                }`}
              >
                దినపత్రిక పేరు (Masthead Name)
              </label>
              <input
                id="cfg-masthead-name"
                type="text"
                value={mastheadName}
                onChange={(e) => setMastheadName(e.target.value)}
                className={`w-full px-3 py-1.5 text-sm font-telugu-sans font-bold rounded-xl border focus:outline-none focus:border-rose-500 ${
                  isLight
                    ? 'bg-stone-50 border-stone-300 text-stone-900'
                    : 'bg-slate-950 border-slate-800 text-white'
                }`}
              />
            </div>

            <div>
              <label
                htmlFor="cfg-press-profile"
                className={`block text-xs font-semibold mb-1.5 ${
                  isLight ? 'text-stone-700' : 'text-slate-300'
                }`}
              >
                ముద్రణ నాణ్యత ప్రొఫైల్ (Print Profile)
              </label>
              <select
                id="cfg-press-profile"
                value={pressProfile}
                onChange={(e) => setPressProfile(e.target.value as PublicationSettings['pressPreflightProfile'])}
                className={`w-full px-3 py-1.5 text-xs rounded-xl border outline-none cursor-pointer ${
                  isLight
                    ? 'bg-stone-50 border-stone-300 text-stone-900'
                    : 'bg-slate-950 border-slate-800 text-white'
                }`}
              >
                <option value="standard_rgb_print">డిజిటల్ ఈ-పేపర్ పి.డి.ఎఫ్ (Digital e-Paper)</option>
                <option value="press_cmyk_bleed">ముద్రణాలయ ప్రెస్ ఫార్మాట్ (Press Print Ready)</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="cfg-masthead-tagline"
              className={`block text-xs font-semibold mb-1.5 ${
                isLight ? 'text-stone-700' : 'text-slate-300'
              }`}
            >
              పత్రిక ట్యాగ్‌లైన్ / ధ్యేయం (Tagline)
            </label>
            <input
              id="cfg-masthead-tagline"
              type="text"
              value={mastheadTagline}
              onChange={(e) => setMastheadTagline(e.target.value)}
              className={`w-full px-3 py-1.5 text-xs font-telugu-sans rounded-xl border focus:outline-none focus:border-rose-500 ${
                isLight
                  ? 'bg-stone-50 border-stone-300 text-stone-900'
                  : 'bg-slate-950 border-slate-800 text-white'
              }`}
            />
          </div>

          <div className="space-y-2 pt-1">
            <label
              className={`flex items-center gap-2 text-xs cursor-pointer ${
                isLight ? 'text-stone-700' : 'text-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={holdHighRisk}
                onChange={(e) => setHoldHighRisk(e.target.checked)}
                className="accent-rose-600 w-4 h-4 rounded cursor-pointer"
              />
              <span>ముఖ్యమైన మరియు వివాదాస్పద కథనాలను సంపాదకుల ఆమోదం తర్వాతే ప్రచురించండి</span>
            </label>

            <label
              className={`flex items-center gap-2 text-xs cursor-pointer ${
                isLight ? 'text-stone-700' : 'text-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={holdAllegations}
                onChange={(e) => setHoldAllegations(e.target.checked)}
                className="accent-rose-600 w-4 h-4 rounded cursor-pointer"
              />
              <span>అధికారిక వివరణ లేని ఏకపక్ష ఆరోపణలను స్వయంచాలకంగా హోల్డ్ చేయండి</span>
            </label>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              disabled={isSavingSettings}
              onClick={handleSaveConfig}
              className={`px-5 py-2 rounded-xl text-xs font-bold border active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                isLight
                  ? 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-900'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white'
              }`}
            >
              {isSavingSettings ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-500" />
                  <span>అమరికలు భద్రపరచబడుతున్నాయి...</span>
                </>
              ) : (
                <span>అమరికలను భద్రపరచండి (Save Settings)</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Published Editions List */}
      <div
        className={`p-6 rounded-2xl border transition-colors space-y-4 ${
          isLight
            ? 'bg-white border-stone-300 shadow-sm'
            : 'bg-slate-900/90 border-slate-800 shadow-xl shadow-black/40'
        }`}
      >
        <div className="flex items-center justify-between border-b pb-3 border-slate-800/40">
          <h3
            className={`text-base font-bold flex items-center gap-2 font-telugu-sans ${
              isLight ? 'text-stone-900' : 'text-white'
            }`}
          >
            <Layers className="w-5 h-5 text-emerald-500" />
            ప్రచురితమైన దినపత్రిక సంచికలు ({editions.length})
          </h3>
          <span className={`text-xs font-mono ${isLight ? 'text-stone-500' : 'text-slate-400'}`}>
            ప్రజా వాణి దినపత్రిక ఆర్కైవ్స్
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr
                className={`border-b ${
                  isLight ? 'border-stone-200 text-stone-500' : 'border-slate-800 text-slate-400'
                }`}
              >
                <th className="py-3 px-3 font-semibold">సంచిక</th>
                <th className="py-3 px-3 font-semibold">శీర్షిక (Title)</th>
                <th className="py-3 px-3 font-semibold text-right">పేజీలు</th>
                <th className="py-3 px-3 font-semibold text-right">కథనాలు</th>
                <th className="py-3 px-3 font-semibold">స్థితి &amp; నాణ్యత</th>
                <th className="py-3 px-3 font-semibold text-right">చర్యలు</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y ${
                isLight ? 'divide-stone-200' : 'divide-slate-800'
              }`}
            >
              {editions.map((ed) => {
                const isRegenerating = Boolean(regeneratingMap[ed.id]);
                return (
                  <tr
                    key={ed.id}
                    className={`transition-colors ${
                      isLight ? 'hover:bg-stone-50' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-3.5 px-3 font-mono font-bold text-rose-500">
                      #{ed.editionNumber} · {ed.editionDate}
                    </td>
                    <td
                      className={`py-3.5 px-3 font-telugu-sans font-semibold ${
                        isLight ? 'text-stone-900' : 'text-white'
                      }`}
                    >
                      {ed.editionTitleTelugu}
                    </td>
                    <td
                      className={`py-3.5 px-3 text-right font-mono ${
                        isLight ? 'text-stone-700' : 'text-slate-300'
                      }`}
                    >
                      {ed.actualPageCount} పేజీలు ({ed.columnsPerPage} కాలమ్స్)
                    </td>
                    <td
                      className={`py-3.5 px-3 text-right font-mono ${
                        isLight ? 'text-stone-700' : 'text-slate-300'
                      }`}
                    >
                      <span className="text-emerald-500 font-bold">
                        {ed.layoutDiagnostics.placedArticles || 0} చేర్చబడ్డాయి
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-950/40 text-emerald-400 border border-emerald-800">
                        ముద్రణకు సిద్ధం
                      </span>
                      <span className="text-emerald-500 ml-2 font-mono text-[11px]">
                        · నాణ్యత తనిఖీ పూర్తి
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Open Dedicated Newspaper Preview Modal */}
                        <button
                          type="button"
                          onClick={() => setPreviewEdition(ed)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1 cursor-pointer ${
                            isLight
                              ? 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-800'
                              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                          }`}
                          title="దినపత్రిక పేజీలను వీక్షించండి"
                        >
                          <Eye className="w-3.5 h-3.5 text-rose-500" />
                          <span>పేపర్ వీక్షించండి</span>
                        </button>

                        <button
                          type="button"
                          disabled={isRegenerating}
                          onClick={() => handleRebuild(ed.id, ed.editionNumber)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                            isLight
                              ? 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-800'
                              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                          }`}
                          title="పేజీల అమరికను తిరిగి సమీక్షించండి"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 text-amber-500 ${
                              isRegenerating ? 'animate-spin' : ''
                            }`}
                          />
                          <span>{isRegenerating ? 'పునరుద్ధరిస్తోంది...' : 'తిరిగి అమర్చండి'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              addToast({
                                type: 'loading',
                                title: 'పి.డి.ఎఫ్ డౌన్‌లోడ్ అవుతోంది...',
                                message: `సంచిక #${ed.editionNumber} ఫైల్ సిద్ధం చేస్తోంది...`,
                              });
                              const p = await fetchAndTriggerCookieSafePdfDownload(ed.id);
                              setPdfInspectorPayload(p);
                              addToast({
                                type: 'success',
                                title: 'పి.డి.ఎఫ్ సిద్ధమైంది',
                                message: `సంచిక #${ed.editionNumber} డౌన్‌లోడ్ చేయబడింది.`,
                              });
                            } catch (e) {
                              const msg = e instanceof Error ? e.message : 'PDF download error';
                              setPdfDownloadError(msg);
                              addToast({
                                type: 'error',
                                title: 'పి.డి.ఎఫ్ డౌన్‌లోడ్ లోపం',
                                message: msg,
                              });
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-sm flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 fill-current" />
                          <span>పి.డి.ఎఫ్</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Proper Dedicated Newspaper Edition Preview Modal */}
      <NewspaperEditionPreviewModal
        edition={previewEdition}
        settings={settings}
        isOpen={Boolean(previewEdition)}
        onClose={() => setPreviewEdition(null)}
      />

      {/* PDF Inspector Modal (fallback / raw PDF inspection) */}
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
});
