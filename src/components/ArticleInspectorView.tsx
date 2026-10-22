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
} from 'lucide-react';
import type {
  AIProcessingJob,
  Article,
  CategoryConfig,
  User,
} from '../shared/types.ts';

interface ArticleInspectorViewProps {
  article: Article | null;
  articles: Article[];
  jobs: AIProcessingJob[];
  categories: CategoryConfig[];
  currentUser: User;
  onSelectArticle: (articleId: string) => void;
  onTriggerProcess: (articleId: string, forceReprocess?: boolean) => Promise<void>;
  onUpdateArticle: (articleId: string, patch: Record<string, unknown>) => Promise<void>;
}

export const ArticleInspectorView: React.FC<ArticleInspectorViewProps> = ({
  article,
  articles,
  jobs,
  categories,
  currentUser,
  onSelectArticle,
  onTriggerProcess,
  onUpdateArticle,
}) => {
  const [editPrimaryHeadline, setEditPrimaryHeadline] = useState('');
  const [editCompactHeadline, setEditCompactHeadline] = useState('');
  const [editStandfirst, setEditStandfirst] = useState('');
  const [editBodyText, setEditBodyText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
      <div className="p-8 bg-white border border-stone-200 text-center">
        <p className="text-sm text-stone-600">Select an article to inspect its dual-model AI editorial pipeline.</p>
      </div>
    );
  }

  const articleJobs = jobs.filter((j) => j.targetId === article.id);
  const latestJob = articleJobs[0] || null;
  const cls = article.classification;

  const handleRunPipeline = async (force = false) => {
    setIsProcessing(true);
    try {
      await onTriggerProcess(article.id, force);
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
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Article Selector & Orchestration Action Bar */}
      <div className="bg-white border border-stone-200 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="inspect-article-select" className="text-xs font-medium text-stone-600">
            Inspect Story:
          </label>
          <select
            id="inspect-article-select"
            value={article.id}
            onChange={(e) => onSelectArticle(e.target.value)}
            className="px-3 py-1.5 text-xs font-telugu-sans font-medium bg-stone-50 border border-stone-300 text-stone-900 max-w-md truncate"
          >
            {articles.map((a) => (
              <option key={a.id} value={a.id}>
                [{a.status.toUpperCase()}] {a.location}: {a.primaryHeadlineTelugu || a.originalHeadline || a.id}
              </option>
            ))}
          </select>

          <div className="text-xs text-stone-500 font-mono-tabular">
            ID: {article.id} · Rev #{article.currentRevision} · Priority: {article.priorityScore}/100
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {article.status === 'flagged_hold' ? (
            <button
              type="button"
              onClick={() => handleSaveEditorialRevision('approved')}
              className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Editor Approve & Release Hold
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSaveEditorialRevision('flagged_hold')}
              className="px-3.5 py-1.5 text-xs font-medium bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Place on Editorial Hold
            </button>
          )}

          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleRunPipeline(true)}
            className="px-4 py-1.5 text-xs font-semibold bg-[#9A3412] text-white hover:bg-[#7C2D12] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            {isProcessing ? 'Running Gemma 4 + Gemini 3.5...' : 'Run Dual-Model AI Pipeline'}
          </button>
        </div>
      </div>

      {/* Validation Warnings & Safety Banners */}
      {article.validationWarnings.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-300 p-4 space-y-2">
          <div className="text-xs font-semibold text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            Editorial Integrity & Safety Flags ({article.validationWarnings.length})
          </div>
          <div className="space-y-1.5">
            {article.validationWarnings.map((w, i) => (
              <div key={i} className="text-xs text-stone-800 flex items-center gap-2">
                <span className="font-mono-tabular font-semibold text-amber-900">
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
          <div className="bg-white border border-stone-200 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
              <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-stone-600" />
                1. Original Reporter Submission (Rev #1 — Immutable)
              </h3>
              <span className="text-xs text-stone-500">
                {article.reporterName || article.reporterId}
              </span>
            </div>

            <div className="text-xs text-stone-500">
              Location: <strong className="text-stone-800 font-telugu-sans">{article.location}</strong> ({article.district}) · Event Date: <span className="font-mono-tabular">{article.eventDate}</span>
            </div>

            {article.originalHeadline && (
              <div className="p-2.5 bg-stone-50 border border-stone-200">
                <div className="text-[11px] text-stone-500 mb-0.5">Original Reporter Headline:</div>
                <div className="font-telugu-sans font-bold text-sm text-stone-900">
                  {article.originalHeadline}
                </div>
              </div>
            )}

            <div>
              <div className="text-[11px] text-stone-500 mb-1">Original Reporter Telugu Text:</div>
              <div className="p-3 bg-stone-50 border border-stone-200 font-telugu-serif text-sm leading-relaxed text-stone-900 whitespace-pre-wrap">
                {article.originalBodyTelugu}
              </div>
            </div>

            {/* Uploaded Photographs & Verified Captions */}
            {article.assets && article.assets.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-semibold text-stone-800">
                  Attached Photographs ({article.assets.length})
                </div>
                {article.assets.map((asset) => (
                  <div key={asset.id} className="border border-stone-200 p-2.5 bg-stone-50 flex gap-3">
                    <img
                      src={asset.publicUrl}
                      alt={asset.captionTelugu}
                      referrerPolicy="no-referrer"
                      className="w-24 h-16 object-cover border border-stone-300 shrink-0"
                    />
                    <div className="text-xs space-y-1">
                      <div className="font-telugu-sans font-medium text-stone-900">
                        {asset.captionTelugu}
                      </div>
                      <div className="font-mono-tabular text-[11px] text-stone-500">
                        {asset.mimeType} · {asset.width}×{asset.height}px · {(asset.fileSizeBytes / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Model A: Gemma 4 31B IT Classification Output */}
          <div className="bg-white border border-stone-200 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
              <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-[#1E3A8A]" />
                2. Model A Classification (`gemma-4-31b-it`)
              </h3>
              <span className="font-mono-tabular text-xs text-stone-600">
                Score: {cls?.priorityScore || article.priorityScore}/100
              </span>
            </div>

            {cls ? (
              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-stone-50 border border-stone-200">
                  <div>
                    <span className="text-stone-500">Section:</span>{' '}
                    <strong className="text-stone-900 font-telugu-sans">
                      {cls.sectionTelugu} ({cls.section})
                    </strong>
                  </div>
                  <div>
                    <span className="text-stone-500">Risk Level:</span>{' '}
                    <strong className="text-stone-900 uppercase">{cls.riskLevel}</strong>
                  </div>
                  <div>
                    <span className="text-stone-500">Local Relevance:</span>{' '}
                    <strong className="font-mono-tabular text-stone-900">{cls.localRelevanceScore}/100</strong>
                  </div>
                  <div>
                    <span className="text-stone-500">Prompt Version:</span>{' '}
                    <span className="font-mono-tabular text-stone-700">{cls.promptVersion}</span>
                  </div>
                </div>

                <div>
                  <span className="text-stone-500 block mb-0.5">Priority Recommendation Rationale:</span>
                  <p className="text-stone-800 bg-stone-50 p-2 border border-stone-200">
                    {cls.priorityExplanation}
                  </p>
                </div>

                <div>
                  <span className="text-stone-500 block mb-0.5">Extracted Telugu Entities:</span>
                  <p className="font-telugu-sans text-stone-900">
                    {cls.entities.length > 0 ? cls.entities.join(' · ') : 'None specified'}
                  </p>
                </div>

                {cls.missingInformation.length > 0 && (
                  <div className="p-2.5 bg-stone-50 border border-stone-200">
                    <div className="font-semibold text-stone-800 mb-1">
                      Missing Source Information (Explicitly Distinguished from Negative Findings):
                    </div>
                    <ul className="list-disc list-inside text-stone-700 space-y-0.5">
                      {cls.missingInformation.map((m, idx) => (
                        <li key={idx}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-stone-500">
                Classification metadata pending. Click "Run Dual-Model AI Pipeline" above.
              </p>
            )}
          </div>
        </div>

        {/* Right 7 Cols: Model B (`gemini-3.5-flash-lite`) Prepared Telugu Story & Revision History */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-stone-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
              <div>
                <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  3. Model B Prepared Telugu Story (`gemini-3.5-flash-lite`)
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Newspaper-ready Telugu headlines, standfirst, and full/compact variants with fact-preservation guard
                </p>
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveEditorialRevision()}
                className="px-3.5 py-1.5 text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Saving Revision...' : 'Save Editorial Revision'}
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="edit-primary-hl" className="block text-xs font-medium text-stone-700 mb-1">
                  Primary Multi-Column Telugu Headline (ప్రధాన శీర్షిక)
                </label>
                <input
                  id="edit-primary-hl"
                  type="text"
                  value={editPrimaryHeadline}
                  onChange={(e) => setEditPrimaryHeadline(e.target.value)}
                  className="w-full px-3 py-2 text-base font-telugu-sans font-bold bg-stone-50 border border-stone-300 text-stone-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-compact-hl" className="block text-xs font-medium text-stone-700 mb-1">
                    Compact Narrow-Column Headline (చిన్న శీర్షిక)
                  </label>
                  <input
                    id="edit-compact-hl"
                    type="text"
                    value={editCompactHeadline}
                    onChange={(e) => setEditCompactHeadline(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm font-telugu-sans font-semibold bg-stone-50 border border-stone-300 text-stone-900"
                  />
                </div>

                <div>
                  <label htmlFor="edit-standfirst" className="block text-xs font-medium text-stone-700 mb-1">
                    Standfirst / Deck (ఉప శీర్షిక)
                  </label>
                  <input
                    id="edit-standfirst"
                    type="text"
                    value={editStandfirst}
                    onChange={(e) => setEditStandfirst(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm font-telugu-sans bg-stone-50 border border-stone-300 text-stone-900"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit-full-body" className="block text-xs font-medium text-stone-700 mb-1">
                  Full Newspaper Telugu Paragraphs (పూర్తి స్థాయి వార్తా పేరాలు)
                </label>
                <textarea
                  id="edit-full-body"
                  rows={7}
                  value={editBodyText}
                  onChange={(e) => setEditBodyText(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-telugu-serif leading-relaxed bg-stone-50 border border-stone-300 text-stone-900"
                />
              </div>

              {/* Short Variant Preview for Column Reflow / Backtracking */}
              {article.aiBodyParagraphsShort && article.aiBodyParagraphsShort.length > 0 && (
                <div className="p-3 bg-stone-50 border border-stone-200 space-y-1">
                  <div className="text-xs font-semibold text-stone-700">
                    Short Space-Constrained Variant (Used by Compositor Backtracking):
                  </div>
                  <p className="font-telugu-serif text-xs leading-relaxed text-stone-800">
                    {article.aiBodyParagraphsShort.join(' ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Model Execution Logs & Immutable Revision History */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-stone-200 p-4 space-y-2.5">
              <h4 className="text-xs font-semibold text-stone-900 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#9A3412]" />
                Model Orchestration Logs
              </h4>
              {latestJob ? (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-mono-tabular text-stone-600">
                    Job: {latestJob.id} · Status: {latestJob.status.toUpperCase()} ({latestJob.progressPercent}%)
                  </div>
                  <div className="p-2.5 bg-stone-900 text-stone-100 font-mono-tabular text-[11px] space-y-1 max-h-44 overflow-y-auto">
                    {latestJob.logs.map((line, idx) => (
                      <div key={idx}>{line}</div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-stone-500">No job execution logs recorded yet.</p>
              )}
            </div>

            <div className="bg-white border border-stone-200 p-4 space-y-2.5">
              <h4 className="text-xs font-semibold text-stone-900 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-stone-700" />
                Immutable Revision Trail ({article.revisions?.length || 0})
              </h4>
              <div className="divide-y divide-stone-200 max-h-48 overflow-y-auto">
                {(article.revisions || []).map((rev) => (
                  <div key={rev.id} className="py-2 text-xs space-y-0.5">
                    <div className="flex items-center justify-between font-mono-tabular">
                      <span className="font-semibold text-stone-900">
                        Rev #{rev.revisionNumber} · {rev.sourceType}
                      </span>
                      <span className="text-stone-500">{rev.createdAt.slice(11, 19)}</span>
                    </div>
                    <div className="font-telugu-sans text-stone-700 truncate">
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
};
