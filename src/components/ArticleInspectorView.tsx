import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  History,
  Play,
  ShieldAlert,
  ShieldCheck,
  Save,
  FileText,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import type {
  AIProcessingJob,
  Article,
  CategoryConfig,
  User,
} from '../shared/types.ts';
import { useToast } from './ToastNotification.tsx';
import { containsTeluguUnicode } from '../utils/editorialLogic.ts';

interface ArticleInspectorViewProps {
  article: Article | null;
  articles: Article[];
  jobs: AIProcessingJob[];
  categories: CategoryConfig[];
  currentUser: User;
  onSelectArticle: (articleId: string) => void;
  onTriggerProcess: (articleId: string, forceReprocess?: boolean) => Promise<void>;
  onUpdateArticle: (articleId: string, patch: Record<string, unknown>) => Promise<void>;
  onDeleteArticle?: (articleId: string) => Promise<void> | void;
}

export const ArticleInspectorView: React.FC<ArticleInspectorViewProps> = React.memo(({
  article,
  articles,
  jobs,
  categories,
  currentUser,
  onSelectArticle,
  onTriggerProcess,
  onUpdateArticle,
  onDeleteArticle,
}) => {
  const { addToast } = useToast();
  const [editPrimaryHeadline, setEditPrimaryHeadline] = useState('');
  const [editCompactHeadline, setEditCompactHeadline] = useState('');
  const [editStandfirst, setEditStandfirst] = useState('');
  const [editBodyText, setEditBodyText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (article) {
      setEditPrimaryHeadline(article.primaryHeadlineTelugu || article.originalHeadline || '');
      setEditCompactHeadline(article.compactHeadlineTelugu || '');
      setEditStandfirst(article.standfirstTelugu || '');
      setEditBodyText(
        article.aiBodyParagraphsFull && article.aiBodyParagraphsFull.length > 0
          ? article.aiBodyParagraphsFull.join('\n\n')
          : article.originalBodyTelugu
      );
    }
  }, [article?.id, article?.currentRevision]);

  if (!article) {
    return (
      <div className="p-12 bg-slate-900/90 border border-slate-800 rounded-2xl text-center shadow-xl">
        <p className="text-sm text-slate-400">వార్తా వివరాలు పరిశీలించడానికి జాబితా నుండి ఒక వార్తను ఎంచుకోండి.</p>
      </div>
    );
  }

  const articleJobs = jobs.filter((j) => j.targetId === article.id);
  const latestJob = articleJobs[0] || null;
  const cls = article.classification;

  const handleRunPipeline = async (force = false) => {
    setIsProcessing(true);
    addToast({
      type: 'loading',
      title: 'వార్తా సమీక్ష ప్రారంభమైంది',
      message: `${article.id} కొరకు సంపాదక పరిశీలన జరుగుతోంది...`,
    });

    try {
      await onTriggerProcess(article.id, force);
      addToast({
        type: 'success',
        title: 'వార్తా సమీక్ష పూర్తయింది',
        message: `తెలుగు శీర్షికలు, ముఖ్యాంశాలు మరియు పేరాగ్రాఫ్‌లు పేజీ కూర్పుకు సిద్ధంగా ఉన్నాయి.`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'సమీక్షలో లోపం ఏర్పడింది',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveEditorialRevision = async (nextStatus?: Article['status']) => {
    setIsSaving(true);
    try {
      const paragraphs = editBodyText
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean);
      await onUpdateArticle(article.id, {
        primaryHeadlineTelugu: editPrimaryHeadline,
        compactHeadlineTelugu: editCompactHeadline,
        standfirstTelugu: editStandfirst,
        aiBodyParagraphsFull: paragraphs,
        status: nextStatus || article.status,
      });

      addToast({
        type: 'success',
        title: nextStatus === 'approved' ? 'Story Approved & Released' : nextStatus === 'flagged_hold' ? 'Placed on Hold' : 'Revision Saved',
        message: `Updated revision #${article.currentRevision + 1} for ${article.id}`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Failed to Save Revision',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Article Selector & Orchestration Action Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl shadow-black/40 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="inspect-article-select" className="text-xs font-semibold text-slate-300">
            Inspect Story:
          </label>
          <select
            id="inspect-article-select"
            value={article.id}
            onChange={(e) => onSelectArticle(e.target.value)}
            className="px-3 py-1.5 text-xs font-telugu-sans font-semibold bg-slate-950 border border-slate-800 text-white rounded-xl max-w-md truncate outline-none cursor-pointer"
          >
            {articles.map((a) => (
              <option key={a.id} value={a.id} className="bg-slate-900 text-white">
                [{a.status.toUpperCase()}] {a.location}: {a.primaryHeadlineTelugu || a.originalHeadline || a.id}
              </option>
            ))}
          </select>

          <div className="text-xs text-slate-400 font-mono-tabular">
            ID: <span className="text-slate-200">{article.id}</span> · Rev <span className="text-amber-400 font-bold">#{article.currentRevision}</span> · Priority: <span className="text-emerald-400 font-bold">{article.priorityScore}/100</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {article.status === 'flagged_hold' ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveEditorialRevision('approved')}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              Editor Approve & Release Hold
            </button>
          ) : (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveEditorialRevision('flagged_hold')}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-600/40 hover:bg-amber-900/60 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Place on Editorial Hold
            </button>
          )}

          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleRunPipeline(true)}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md shadow-amber-500/25 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Processing Models...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>వార్తా పరిశీలన (Editorial Review)</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isDeleting}
            onClick={async () => {
              const title = article.primaryHeadlineTelugu || article.originalHeadline || article.id;
              if (
                window.confirm(
                  `Are you sure you want to permanently delete this submission?\n\n"${title}"\n\nThis will remove the article, revisions, and any attached photos.`
                )
              ) {
                setIsDeleting(true);
                try {
                  await onDeleteArticle?.(article.id);
                } finally {
                  setIsDeleting(false);
                }
              }
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-950/70 text-rose-300 border border-rose-800/60 hover:bg-rose-900/80 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Delete article submission"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            Delete Story
          </button>
        </div>
      </div>

      {/* Validation Warnings & Safety Banners */}
      {article.validationWarnings.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 shadow-lg space-y-2">
          <div className="text-xs font-bold text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            Editorial Integrity & Safety Flags ({article.validationWarnings.length})
          </div>
          <div className="space-y-1.5">
            {article.validationWarnings.map((w, i) => (
              <div key={i} className="text-xs text-amber-200/90 flex items-center gap-2">
                <span className="font-mono-tabular font-bold px-1.5 py-0.5 rounded bg-amber-900/60 border border-amber-700/60 text-amber-300">
                  [{w.code} · {w.severity.toUpperCase()}]
                </span>
                <span>{w.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison: Original Reporter Text vs AI-Prepared Telugu Story */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Cols: Immutable Original Reporter Submission + Model A Classification */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl shadow-black/40 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" />
                1. Original Reporter Dispatch (Rev #1 — Immutable)
              </h3>
              <span className="text-xs text-slate-400">
                {article.reporterName || article.reporterId}
              </span>
            </div>

            <div className="text-xs text-slate-400">
              Location: <strong className="text-slate-200 font-telugu-sans">{article.location}</strong> ({article.district}) · Event Date: <span className="font-mono-tabular text-slate-200">{article.eventDate}</span>
            </div>

            {article.originalHeadline && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <div className="text-[11px] text-slate-400 mb-0.5">Original Reporter Headline:</div>
                <div className="font-telugu-sans font-bold text-sm text-white">
                  {article.originalHeadline}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>Original Reporter Submission:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  containsTeluguUnicode(article.originalBodyTelugu)
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}>
                  {containsTeluguUnicode(article.originalBodyTelugu) ? 'తెలుగు సమర్పణ (Telugu)' : 'ఆంగ్ల సమర్పణ (English) -> తెలుగు ముద్రణ'}
                </span>
              </div>
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl font-telugu-serif text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
                {article.originalBodyTelugu}
              </div>
            </div>

            {/* Uploaded Photographs & Verified Captions */}
            {article.assets && article.assets.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-semibold text-slate-300">
                  Attached Photographs ({article.assets.length})
                </div>
                {article.assets.map((asset) => (
                  <div key={asset.id} className="border border-slate-800 p-2.5 bg-slate-950 rounded-xl flex gap-3 items-center">
                    <img
                      src={asset.publicUrl}
                      alt={asset.captionTelugu}
                      referrerPolicy="no-referrer"
                      className="w-24 h-16 object-cover border border-slate-700 rounded-lg shrink-0"
                    />
                    <div className="text-xs space-y-1">
                      <div className="font-telugu-sans font-medium text-white line-clamp-1">
                        {asset.captionTelugu}
                      </div>
                      <div className="font-mono-tabular text-[11px] text-slate-400">
                        {asset.mimeType} · {asset.width}×{asset.height}px · {(asset.fileSizeBytes / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Model A: Gemma 4 31B IT Classification Output */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl shadow-black/40 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-cyan-400" />
                2. వార్తా వర్గీకరణ &amp; ప్రాధాన్యత విశ్లేషణ (Classification &amp; Priority)
              </h3>
              <span className="font-mono-tabular text-xs font-bold text-cyan-400">
                Score: {cls?.priorityScore || article.priorityScore}/100
              </span>
            </div>

            {cls ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div>
                    <span className="text-slate-400">Section:</span>{' '}
                    <strong className="text-amber-400 font-telugu-sans">
                      {cls.sectionTelugu} ({cls.section})
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Risk Level:</span>{' '}
                    <strong className={`uppercase font-bold ${cls.riskLevel === 'high' ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {cls.riskLevel}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Local Relevance:</span>{' '}
                    <strong className="font-mono-tabular text-slate-200">{cls.localRelevanceScore}/100</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Prompt Version:</span>{' '}
                    <span className="font-mono-tabular text-slate-300">{cls.promptVersion}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Priority Recommendation Rationale:</span>
                  <p className="text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800 leading-relaxed">
                    {cls.priorityExplanation}
                  </p>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Extracted Telugu Entities:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {cls.entities.length > 0 ? (
                      cls.entities.map((ent, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700 font-telugu-sans text-[11px]">
                          {ent}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500">None specified</span>
                    )}
                  </div>
                </div>

                {cls.missingInformation.length > 0 && (
                  <div className="p-3 bg-amber-950/30 border border-amber-600/30 rounded-xl">
                    <div className="font-bold text-amber-300 mb-1">
                      Missing Source Information:
                    </div>
                    <ul className="list-disc list-inside text-amber-200/90 space-y-0.5">
                      {cls.missingInformation.map((m, idx) => (
                        <li key={idx}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                వర్గీకరణ వివరాలు పెండింగ్‌లో ఉన్నాయి. పైన ఉన్న "వార్తా పరిశీలన" బటన్ నొక్కండి.
              </p>
            )}
          </div>
        </div>

        {/* Right 7 Cols: Model B (`gemini-3.5-flash-lite`) Prepared Telugu Story & Revision History */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl shadow-black/40 space-y-4">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  3. ప్రచురణకు సిద్ధమైన తెలుగు కథనం (Editorial Story Draft)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  పత్రిక ప్రచురణకు సిద్ధంగా ఉన్న తెలుగు శీర్షికలు, ముఖ్యాంశాలు మరియు పేరాగ్రాఫ్‌లు
                </p>
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveEditorialRevision()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 text-amber-400" />
                {isSaving ? 'Saving Revision...' : 'Save Editorial Revision'}
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="edit-primary-hl" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Primary Multi-Column Telugu Headline (ప్రధాన శీర్షిక)
                </label>
                <input
                  id="edit-primary-hl"
                  type="text"
                  value={editPrimaryHeadline}
                  onChange={(e) => setEditPrimaryHeadline(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-base font-telugu-sans font-bold bg-slate-950 border border-slate-800 text-white rounded-xl focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-compact-hl" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Compact Narrow-Column Headline (చిన్న శీర్షిక)
                  </label>
                  <input
                    id="edit-compact-hl"
                    type="text"
                    value={editCompactHeadline}
                    onChange={(e) => setEditCompactHeadline(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-telugu-sans font-semibold bg-slate-950 border border-slate-800 text-white rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label htmlFor="edit-standfirst" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Standfirst / Deck (ఉప శీర్షిక)
                  </label>
                  <input
                    id="edit-standfirst"
                    type="text"
                    value={editStandfirst}
                    onChange={(e) => setEditStandfirst(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-telugu-sans bg-slate-950 border border-slate-800 text-white rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit-full-body" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Full Newspaper Telugu Paragraphs (పూర్తి స్థాయి వార్తా పేరాలు)
                </label>
                <textarea
                  id="edit-full-body"
                  rows={7}
                  value={editBodyText}
                  onChange={(e) => setEditBodyText(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-telugu-serif leading-relaxed bg-slate-950 border border-slate-800 text-slate-100 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all"
                />
              </div>

              {/* Short Variant Preview */}
              {article.aiBodyParagraphsShort && article.aiBodyParagraphsShort.length > 0 && (
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                  <div className="text-xs font-bold text-amber-400 font-telugu-sans">
                    సంక్షిప్త రూపం (కాలమ్స్ స్థలానికి అనుగుణంగా):
                  </div>
                  <p className="font-telugu-serif text-xs leading-relaxed text-slate-300">
                    {article.aiBodyParagraphsShort.join(' ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Activity Logs & Revision History */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl shadow-black/40 space-y-2.5">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 font-telugu-sans">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                కార్యనిర్వహణ వివరాలు (Activity Details)
              </h4>
              {latestJob ? (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-mono-tabular text-slate-400 flex justify-between">
                    <span>ప్రక్రియ ID: {latestJob.id}</span>
                    <span className="text-cyan-400 font-bold">{latestJob.status.toUpperCase()} ({latestJob.progressPercent}%)</span>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl text-slate-300 font-mono-tabular text-[11px] space-y-1 max-h-44 overflow-y-auto border border-slate-800">
                    {latestJob.logs.map((line, idx) => (
                      <div key={idx} className="text-slate-400">{line}</div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">కార్యకలాపాలు ఏవీ నమోదు కాలేదు.</p>
              )}
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl shadow-black/40 space-y-2.5">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 font-telugu-sans">
                <History className="w-3.5 h-3.5 text-amber-400" />
                కథన సవరణల చరిత్ర ({article.revisions?.length || 0})
              </h4>
              <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto pr-1">
                {(article.revisions || []).map((rev) => (
                  <div key={rev.id} className="py-2 text-xs space-y-0.5">
                    <div className="flex items-center justify-between font-mono-tabular">
                      <span className="font-bold text-white">
                        Rev #{rev.revisionNumber} · {rev.sourceType}
                      </span>
                      <span className="text-slate-500">{rev.createdAt.slice(11, 19)}</span>
                    </div>
                    <div className="font-telugu-sans text-slate-400 truncate">
                      {rev.primaryHeadlineTelugu || rev.headlineOriginal || rev.bodyTextOriginal.slice(0, 50)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

