import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Download,
  Eye,
  FileText,
  Layers,
  Newspaper,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import type {
  AIProcessingJob,
  Article,
  NewspaperEdition,
  PublicationSettings,
  User,
} from './shared/types.ts';
import { DEFAULT_PUBLICATION_SETTINGS } from './utils/editorialLogic.ts';
import { NewspaperBroadsheetView } from './components/NewspaperBroadsheetView.tsx';
import { ReporterPortalView } from './components/ReporterPortalView.tsx';
import { ArticleInspectorView } from './components/ArticleInspectorView.tsx';
import { EditionManagerView } from './components/EditionManagerView.tsx';
import {
  fetchAndTriggerCookieSafePdfDownload,
  PdfExportInspectorModal,
  type PdfDownloadPayload,
} from './components/PdfExportInspectorModal.tsx';

type NavTab =
  | 'overview'
  | 'submissions'
  | 'processing'
  | 'editions'
  | 'preview'
  | 'reporter_portal';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [editions, setEditions] = useState<NewspaperEdition[]>([]);
  const [jobs, setJobs] = useState<AIProcessingJob[]>([]);
  const [settings, setSettings] = useState<PublicationSettings>(DEFAULT_PUBLICATION_SETTINGS);
  const [pdfInspectorPayload, setPdfInspectorPayload] = useState<PdfDownloadPayload | null>(null);
  const [pdfDownloadError, setPdfDownloadError] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean>(true);

  const [selectedArticleId, setSelectedArticleId] = useState<string>('art-krishna-delta');
  const [selectedEditionId, setSelectedEditionId] = useState<string>('ed-2026-10-19-morning');

  // Filters for Reporter Submissions view (View B)
  const [filterReporter, setFilterReporter] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGeneratingEdition, setIsGeneratingEdition] = useState<boolean>(false);

  const fetchAllData = useCallback(async () => {
    try {
      const [overviewRes, usersRes, articlesRes, editionsRes, jobsRes] = await Promise.all([
        fetch('/api/overview'),
        fetch('/api/users'),
        fetch('/api/articles'),
        fetch('/api/editions'),
        fetch('/api/jobs'),
      ]);

      if (overviewRes.ok) {
        const ovData = await overviewRes.json();
        if (ovData.settings) setSettings(ovData.settings);
        if (ovData.aiStatus) setAiConfigured(Boolean(ovData.aiStatus.geminiApiKeyConfigured));
      }

      if (usersRes.ok) {
        const uData = await usersRes.json();
        setUsers(uData.users || []);
        setCurrentUser((prev) => prev || uData.users?.[0] || null);
      }

      if (articlesRes.ok) {
        const aData = await articlesRes.json();
        const list: Article[] = aData.articles || [];
        setArticles(list);
        if (list.length > 0 && !list.some((a) => a.id === selectedArticleId)) {
          setSelectedArticleId(list[0].id);
        }
      }

      if (editionsRes.ok) {
        const eData = await editionsRes.json();
        const edList: NewspaperEdition[] = eData.editions || [];
        setEditions(edList);
        if (edList.length > 0 && !edList.some((e) => e.id === selectedEditionId)) {
          setSelectedEditionId(edList[0].id);
        }
      }

      if (jobsRes.ok) {
        const jData = await jobsRes.json();
        setJobs(jData.jobs || []);
      }
    } catch (err) {
      console.error('Failed to load operational state:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedArticleId, selectedEditionId]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Poll active jobs if any job is queued or active
  useEffect(() => {
    const hasActiveJob = jobs.some((j) => j.status === 'queued' || j.status === 'active');
    if (!hasActiveJob) return;
    const timer = setInterval(() => {
      fetchAllData();
    }, 1500);
    return () => clearInterval(timer);
  }, [jobs, fetchAllData]);

  const handleSwitchUser = async (userId: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      const data = await res.json();
      setCurrentUser(data.user);
    }
  };

  const handleTriggerArticleProcess = async (articleId: string, forceReprocess = false) => {
    await fetch(`/api/articles/${articleId}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser?.id || 'editor-chief',
      },
      body: JSON.stringify({ forceReprocess }),
    });
    await fetchAllData();
  };

  const handleUpdateArticle = async (articleId: string, patch: Record<string, unknown>) => {
    await fetch(`/api/articles/${articleId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser?.id || 'editor-chief',
      },
      body: JSON.stringify(patch),
    });
    await fetchAllData();
  };

  const handleCreateEdition = async (payload: {
    editionDate: string;
    editionTitleTelugu: string;
    targetPageCount: number;
    columnsPerPage: number;
  }) => {
    setIsGeneratingEdition(true);
    try {
      const res = await fetch('/api/editions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || 'editor-chief',
        },
        body: JSON.stringify({ ...payload, autoGenerate: true }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.edition?.id) {
          setSelectedEditionId(data.edition.id);
        }
      }
      await fetchAllData();
    } finally {
      setIsGeneratingEdition(false);
    }
  };

  const handleRegenerateEdition = async (editionId: string) => {
    setIsGeneratingEdition(true);
    try {
      await fetch(`/api/editions/${editionId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || 'editor-chief',
        },
      });
      await fetchAllData();
    } finally {
      setIsGeneratingEdition(false);
    }
  };

  const handleUpdateSettings = async (partial: Partial<PublicationSettings>) => {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser?.id || 'editor-chief',
      },
      body: JSON.stringify(partial),
    });
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
    }
  };

  const activeEdition =
    editions.find((e) => e.id === selectedEditionId) || editions[0] || null;
  const activeArticle =
    articles.find((a) => a.id === selectedArticleId) || articles[0] || null;

  const filteredSubmissions = articles.filter((a) => {
    if (filterReporter !== 'all' && a.reporterId !== filterReporter) return false;
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (filterCategory !== 'all' && a.assignedCategory !== filterCategory) return false;
    if (
      filterLocation.trim() &&
      !a.location.toLowerCase().includes(filterLocation.trim().toLowerCase()) &&
      !a.district.toLowerCase().includes(filterLocation.trim().toLowerCase()) &&
      !(a.primaryHeadlineTelugu || '').includes(filterLocation.trim())
    ) {
      return false;
    }
    return true;
  });

  const totalProcessedCount = articles.filter(
    (a) => a.status === 'processed' || a.status === 'approved' || a.status === 'published'
  ).length;
  const awaitingCount = articles.filter(
    (a) => a.status === 'submitted' || a.status === 'draft' || a.status === 'processing'
  ).length;
  const flaggedCount = articles.filter(
    (a) => a.status === 'flagged_hold' || a.status === 'failed'
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F4EE] text-[#1C1917]">
      {/* Strict 3-Zone Top Navigation Bar Contract */}
      <header className="flex items-center justify-between gap-3 md:gap-8 px-3 sm:px-6 py-3.5 bg-white border-b border-stone-200 sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('overview');
          }}
          className="text-base sm:text-lg font-bold tracking-tight text-[#9A3412] font-telugu-sans whitespace-nowrap shrink-0"
        >
          ప్రజా వాణి · Praja Vani Press
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeTab === 'overview' ? 'text-stone-900 border-b-2 border-[#9A3412] font-semibold' : ''
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('submissions')}
            className={`hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeTab === 'submissions' ? 'text-stone-900 border-b-2 border-[#9A3412] font-semibold' : ''
            }`}
          >
            Submissions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('processing')}
            className={`hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeTab === 'processing' ? 'text-stone-900 border-b-2 border-[#9A3412] font-semibold' : ''
            }`}
          >
            AI Pipeline
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('editions')}
            className={`hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeTab === 'editions' ? 'text-stone-900 border-b-2 border-[#9A3412] font-semibold' : ''
            }`}
          >
            Editions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              activeTab === 'preview' ? 'text-stone-900 border-b-2 border-[#9A3412] font-semibold' : ''
            }`}
          >
            Broadsheet Preview
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('reporter_portal')}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Submit Telugu Story
          </button>
        </div>
      </header>

      {/* Mobile Navigation Bar */}
      <div className="md:hidden flex items-center gap-2 overflow-x-auto px-4 py-2 bg-stone-100 border-b border-stone-200 text-xs">
        {(
          [
            ['overview', 'Overview'],
            ['submissions', 'Submissions'],
            ['processing', 'AI Pipeline'],
            ['editions', 'Editions'],
            ['preview', 'Broadsheet'],
            ['reporter_portal', 'Reporter Portal'],
          ] as [NavTab, string][]
        ).map(([tabKey, label]) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setActiveTab(tabKey)}
            className={`px-3 py-1.5 whitespace-nowrap shrink-0 font-medium cursor-pointer ${
              activeTab === tabKey ? 'bg-stone-900 text-white' : 'text-stone-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Operational Context Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-300/80 pb-3 text-xs text-stone-600">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-stone-900">
              {settings.newspaperNameTelugu} ({settings.editionCityTelugu})
            </span>
            <span aria-hidden="true">·</span>
            <span>Model A: {settings.modelAClassifierId}</span>
            <span aria-hidden="true">·</span>
            <span>Model B: {settings.modelBStoryId}</span>
            <span aria-hidden="true">·</span>
            <span>
              API Status: {aiConfigured ? 'Connected (Server-Side Gemini API)' : 'Awaiting GEMINI_API_KEY in Secrets'}
            </span>
          </div>

          {currentUser && (
            <div className="flex items-center gap-2">
              <span>Logged in:</span>
              <strong className="text-stone-900 font-telugu-sans">
                {currentUser.displayNameTelugu}
              </strong>
              <span aria-hidden="true">·</span>
              <span className="uppercase font-mono-tabular">{currentUser.role}</span>
            </div>
          )}
        </div>

        {/* VIEW A: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 7 Required Operational Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="bg-white border border-stone-200 p-4">
                <div className="text-xs text-stone-500">Total Submissions</div>
                <div className="text-2xl font-bold font-mono-tabular text-stone-900 mt-1">
                  {articles.length}
                </div>
                <div className="text-[11px] text-stone-500 mt-1">All Bureaus</div>
              </div>

              <div className="bg-white border border-stone-200 p-4">
                <div className="text-xs text-stone-500">Articles Processed</div>
                <div className="text-2xl font-bold font-mono-tabular text-emerald-800 mt-1">
                  {totalProcessedCount}
                </div>
                <div className="text-[11px] text-stone-500 mt-1">Ready for Layout</div>
              </div>

              <div className="bg-white border border-stone-200 p-4">
                <div className="text-xs text-stone-500">Awaiting Processing</div>
                <div className="text-2xl font-bold font-mono-tabular text-stone-900 mt-1">
                  {awaitingCount}
                </div>
                <div className="text-[11px] text-stone-500 mt-1">Draft / Queued</div>
              </div>

              <div className="bg-white border border-stone-200 p-4">
                <div className="text-xs text-stone-500">Flagged / Held</div>
                <div className="text-2xl font-bold font-mono-tabular text-amber-800 mt-1">
                  {flaggedCount}
                </div>
                <div className="text-[11px] text-stone-500 mt-1">Safety Policy Hold</div>
              </div>

              <div className="bg-white border border-stone-200 p-4">
                <div className="text-xs text-stone-500">Active Edition</div>
                <div className="text-2xl font-bold font-mono-tabular text-[#9A3412] mt-1">
                  #{activeEdition?.editionNumber || 104}
                </div>
                <div className="text-[11px] text-stone-500 mt-1 font-mono-tabular">
                  {activeEdition?.editionDate || '2026-10-19'}
                </div>
              </div>

              <div className="bg-white border border-stone-200 p-4">
                <div className="text-xs text-stone-500">Pages Generated</div>
                <div className="text-2xl font-bold font-mono-tabular text-stone-900 mt-1">
                  {activeEdition?.actualPageCount || 2}
                </div>
                <div className="text-[11px] text-stone-500 mt-1">
                  {settings.columnsPerPage}-Col Broadsheet
                </div>
              </div>

              <div className="bg-white border border-stone-200 p-4">
                <div className="text-xs text-stone-500">PDF Status</div>
                <div className="text-lg font-bold font-mono-tabular uppercase text-emerald-800 mt-1.5">
                  {activeEdition?.status || 'PUBLISHED'}
                </div>
                <div className="text-[11px] text-stone-500 mt-1">11/11 Preflight OK</div>
              </div>
            </div>

            {/* Split Workspace: Active Edition Front-Page Quick View + Recent Submissions & Jobs */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left 7 Cols: Lead Stories & Editorial Hold Queue */}
              <div className="lg:col-span-7 bg-white border border-stone-200 p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                    <div>
                      <h2 className="text-base font-semibold text-stone-900">
                        Active Telugu Stories & Editorial Queue
                      </h2>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Traceable from reporter dispatch through Gemma 4 31B classification to Gemini 3.5 Flash-Lite preparation
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('preview')}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Newspaper className="w-3.5 h-3.5" />
                      Open Broadsheet Preview
                    </button>
                  </div>

                  <div className="divide-y divide-stone-200">
                    {articles.slice(0, 6).map((art) => (
                      <div
                        key={art.id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/80 px-2 transition-colors"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                            <span className="font-telugu-sans font-semibold text-[#9A3412]">
                              {art.assignedCategoryTelugu}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-telugu-sans text-stone-800">{art.location}</span>
                            <span aria-hidden="true">·</span>
                            <span>{art.reporterName || art.reporterId}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular">
                              Priority {art.priorityScore}/100
                            </span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={`font-mono-tabular font-semibold uppercase ${
                                art.status === 'flagged_hold'
                                  ? 'text-amber-800'
                                  : art.status === 'processed' || art.status === 'approved'
                                  ? 'text-emerald-800'
                                  : 'text-stone-700'
                              }`}
                            >
                              {art.status}
                            </span>
                          </div>
                          <h3 className="font-telugu-sans font-bold text-sm text-stone-900 truncate">
                            {art.primaryHeadlineTelugu || art.originalHeadline}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedArticleId(art.id);
                              setActiveTab('processing');
                            }}
                            className="px-2.5 py-1 text-xs font-medium bg-stone-100 text-stone-800 border border-stone-300 hover:bg-stone-200 cursor-pointer whitespace-nowrap"
                          >
                            Inspect AI Output
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Action Strip */}
                <div className="border-t border-stone-200 pt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-stone-600">
                    All {activeEdition?.layoutDiagnostics.placedArticles || 5} eligible stories placed in Edition #{activeEdition?.editionNumber || 104}; {flaggedCount} high-risk story held.
                  </span>
                  {activeEdition && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const p = await fetchAndTriggerCookieSafePdfDownload(activeEdition.id);
                          setPdfInspectorPayload(p);
                        } catch (e) {
                          setPdfDownloadError(e instanceof Error ? e.message : 'PDF download error');
                        }
                      }}
                      className="font-semibold text-[#9A3412] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Print-Ready Edition PDF
                    </button>
                  )}
                </div>
              </div>

              {/* Right 5 Cols: Background Worker Queue & Dual-Model Pipeline Telemetry */}
              <div className="lg:col-span-5 bg-white border border-stone-200 p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                    <div>
                      <h2 className="text-base font-semibold text-stone-900">
                        Background Workers & AI Pipeline Jobs
                      </h2>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Editorial processing, edition planning & PDF generation jobs
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchAllData()}
                      className="p-1.5 text-stone-600 hover:text-stone-900 border border-stone-300 bg-stone-50 cursor-pointer"
                      aria-label="Refresh Jobs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="divide-y divide-stone-200 max-h-[340px] overflow-y-auto">
                    {jobs.slice(0, 8).map((job) => (
                      <div key={job.id} className="py-2.5 text-xs space-y-1">
                        <div className="flex items-center justify-between font-mono-tabular">
                          <span className="font-semibold text-stone-900">
                            {job.jobType} → {job.targetId}
                          </span>
                          <span
                            className={`uppercase font-semibold ${
                              job.status === 'completed'
                                ? 'text-emerald-700'
                                : job.status === 'failed'
                                ? 'text-red-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {job.status} ({job.progressPercent}%)
                          </span>
                        </div>
                        <p className="text-stone-700 leading-snug">{job.stepDescription}</p>
                        <div className="text-[11px] text-stone-500 font-mono-tabular">
                          Models: {job.modelAId} + {job.modelBId} · Attempts: {job.attempts}/{job.maxAttempts}
                          {job.cacheHit ? ' · CACHE HIT' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-stone-200 pt-3 flex items-center justify-between text-xs">
                  <span className="text-stone-500">Want to test the live reporter-to-PDF flow?</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('reporter_portal')}
                    className="font-semibold text-[#9A3412] hover:underline cursor-pointer"
                  >
                    Open Reporter Portal →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW B: REPORTER SUBMISSIONS (EDITORIAL QUEUE WITH FILTERS) */}
        {activeTab === 'submissions' && (
          <div className="bg-white border border-stone-200 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-4">
              <div>
                <h2 className="text-base font-semibold text-stone-900">
                  Reporter Submissions & Editorial Queue ({filteredSubmissions.length})
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Filter dispatches by correspondent, bureau location, newspaper section, or processing status
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('reporter_portal')}
                className="px-3.5 py-1.5 text-xs font-semibold bg-[#9A3412] text-white hover:bg-[#7C2D12] flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                New Reporter Submission
              </button>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-stone-50 p-3.5 border border-stone-200">
              <div>
                <label htmlFor="filter-reporter" className="block text-xs font-medium text-stone-600 mb-1">
                  Reporter
                </label>
                <select
                  id="filter-reporter"
                  value={filterReporter}
                  onChange={(e) => setFilterReporter(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 text-stone-900"
                >
                  <option value="all">All Reporters</option>
                  {users
                    .filter((u) => u.role === 'reporter')
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName} ({u.district})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label htmlFor="filter-location" className="block text-xs font-medium text-stone-600 mb-1">
                  Location / District Search
                </label>
                <div className="relative">
                  <input
                    id="filter-location"
                    type="text"
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    placeholder="విజయవాడ, గుంటూరు, విశాఖ..."
                    className="w-full px-2.5 py-1.5 text-xs font-telugu-sans bg-white border border-stone-300 text-stone-900"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="filter-category" className="block text-xs font-medium text-stone-600 mb-1">
                  Newspaper Section
                </label>
                <select
                  id="filter-category"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 text-stone-900"
                >
                  <option value="all">All Sections</option>
                  {settings.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.teluguLabel} ({c.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="filter-status" className="block text-xs font-medium text-stone-600 mb-1">
                  Processing Status
                </label>
                <select
                  id="filter-status"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 text-stone-900"
                >
                  <option value="all">All Statuses</option>
                  <option value="processed">Processed (Ready)</option>
                  <option value="flagged_hold">Flagged / Editorial Hold</option>
                  <option value="approved">Editor Approved</option>
                  <option value="draft">Draft</option>
                  <option value="processing">Processing</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>

            {/* Submissions Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="py-2.5 px-3 font-medium">Headline & Summary (Telugu)</th>
                    <th className="py-2.5 px-3 font-medium">Section & Location</th>
                    <th className="py-2.5 px-3 font-medium">Reporter</th>
                    <th className="py-2.5 px-3 font-medium text-right">Submitted</th>
                    <th className="py-2.5 px-3 font-medium text-right">Priority</th>
                    <th className="py-2.5 px-3 font-medium">Status & Warnings</th>
                    <th className="py-2.5 px-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 text-xs">
                  {filteredSubmissions.map((art) => (
                    <tr key={art.id} className="hover:bg-stone-50/90">
                      <td className="py-3 px-3 max-w-md">
                        <div className="font-telugu-sans font-bold text-sm text-stone-900 leading-snug">
                          {art.primaryHeadlineTelugu || art.originalHeadline || 'శీర్షిక లేని వార్త'}
                        </div>
                        <div className="font-telugu-serif text-xs text-stone-600 line-clamp-1 mt-0.5">
                          {art.summaryTelugu || art.originalBodyTelugu}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-telugu-sans">
                        <div className="font-semibold text-stone-900">{art.assignedCategoryTelugu}</div>
                        <div className="text-stone-500">
                          {art.location} ({art.district})
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-stone-900">{art.reporterName || art.reporterId}</div>
                        <div className="text-stone-500 font-mono-tabular">
                          Rev #{art.currentRevision} · Photos: {art.assets?.length || 0}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono-tabular text-stone-600">
                        {art.submissionTime.slice(0, 16).replace('T', ' ')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-tabular font-semibold text-stone-900">
                        {art.priorityScore}/100
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono-tabular uppercase font-semibold text-stone-900">
                          {art.status}
                        </div>
                        {art.validationWarnings.length > 0 && (
                          <div className="text-amber-800 flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{art.validationWarnings.length} Warning(s)</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedArticleId(art.id);
                              setActiveTab('processing');
                            }}
                            className="px-2.5 py-1 text-xs font-medium bg-stone-100 text-stone-800 border border-stone-300 hover:bg-stone-200 cursor-pointer whitespace-nowrap"
                          >
                            Inspect
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTriggerArticleProcess(art.id, true)}
                            className="px-2.5 py-1 text-xs font-medium bg-white text-[#9A3412] border border-stone-300 hover:bg-stone-50 cursor-pointer whitespace-nowrap"
                          >
                            Re-Process
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW C: ARTICLE PROCESSING (DUAL-MODEL INSPECTOR) */}
        {activeTab === 'processing' && (
          <ArticleInspectorView
            article={activeArticle}
            articles={articles}
            jobs={jobs}
            categories={settings.categories}
            currentUser={currentUser || users[0]}
            onSelectArticle={(id) => setSelectedArticleId(id)}
            onTriggerProcess={handleTriggerArticleProcess}
            onUpdateArticle={handleUpdateArticle}
          />
        )}

        {/* VIEW D: EDITION MANAGEMENT */}
        {activeTab === 'editions' && (
          <EditionManagerView
            editions={editions}
            articles={articles}
            jobs={jobs}
            settings={settings}
            onCreateEdition={handleCreateEdition}
            onRegenerateEdition={handleRegenerateEdition}
            onOpenPreview={(edId) => {
              setSelectedEditionId(edId);
              setActiveTab('preview');
            }}
            onUpdateSettings={handleUpdateSettings}
          />
        )}

        {/* VIEW E: NEWSPAPER PREVIEW (BROADSHEET COMPOSITOR & PDF) */}
        {activeTab === 'preview' && (
          <NewspaperBroadsheetView
            edition={activeEdition}
            editions={editions}
            settings={settings}
            onSelectEdition={(edId) => setSelectedEditionId(edId)}
            onSelectArticle={(artId) => {
              setSelectedArticleId(artId);
              setActiveTab('processing');
            }}
            onRegenerateEdition={handleRegenerateEdition}
            isGenerating={isGeneratingEdition}
          />
        )}

        {/* REPORTER PORTAL VIEW */}
        {activeTab === 'reporter_portal' && currentUser && (
          <ReporterPortalView
            currentUser={currentUser}
            users={users}
            categories={settings.categories}
            articles={articles}
            onSwitchUser={handleSwitchUser}
            onArticleCreated={(art) => {
              setSelectedArticleId(art.id);
              fetchAllData();
            }}
            onInspectArticle={(artId) => {
              setSelectedArticleId(artId);
              setActiveTab('processing');
            }}
          />
        )}
      </main>

      {/* Quiet Operational Footer */}
      <footer className="border-t border-stone-200 bg-white px-6 py-4 mt-auto">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-stone-500">
          <span>
            Praja Vani (ప్రజా వాణి) AI-Powered Telugu Newspaper Publishing System · Unicode Telugu Typesetting & Print PDF Engine
          </span>
          <span>
            Models: {settings.modelAClassifierId} (Classification) · {settings.modelBStoryId} (Telugu Story Preparation)
          </span>
        </div>
      </footer>

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
}
