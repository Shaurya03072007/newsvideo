import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
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
  Sparkles,
  Zap,
  Trash2,
  LogOut,
  Sun,
  Moon,
  Users,
  Palette,
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
import { ReportersManagementView } from './components/ReportersManagementView.tsx';
import {
  fetchAndTriggerCookieSafePdfDownload,
  PdfExportInspectorModal,
  type PdfDownloadPayload,
} from './components/PdfExportInspectorModal.tsx';
import { ToastProvider, useToast } from './components/ToastNotification.tsx';
import { LiveActivityHud } from './components/LiveActivityHud.tsx';
import { BreakingNewsTicker, newsroomAudio } from './components/BreakingNewsTicker.tsx';
import { GoogleAccountProfileModal } from './components/GoogleAccountProfileModal.tsx';
import { LoginGateView } from './components/LoginGateView.tsx';
import { ThemeSelectorModal } from './components/ThemeSelectorModal.tsx';
import {
  getThemeById,
  STANDARD_THEME_ID,
  applyThemeToDocument,
} from './themes/themeCatalog.ts';

type NavTab =
  | 'overview'
  | 'submissions'
  | 'processing'
  | 'editions'
  | 'preview'
  | 'reporters'
  | 'reporter_portal';

export const TAB_ROUTES: Record<NavTab, string> = {
  overview: '/overview',
  submissions: '/submissions',
  processing: '/pipeline',
  editions: '/editions',
  preview: '/broadsheet',
  reporters: '/reporters',
  reporter_portal: '/reporter',
};

export function resolveTabFromPath(pathname: string): NavTab {
  const clean = pathname.toLowerCase().replace(/\/$/, '') || '/';
  if (clean === '/' || clean === '/overview') return 'overview';
  if (clean === '/submissions' || clean === '/stories') return 'submissions';
  if (clean === '/pipeline' || clean === '/processing') return 'processing';
  if (clean === '/editions') return 'editions';
  if (clean === '/broadsheet' || clean === '/preview' || clean === '/epaper') return 'preview';
  if (clean === '/reporters' || clean === '/journalists') return 'reporters';
  if (clean === '/reporter' || clean === '/reporter-portal' || clean === '/submit') return 'reporter_portal';
  return 'overview';
}

function AppContent() {
  const { addToast } = useToast();
  const [activeTab, _setActiveTabRaw] = useState<NavTab>(() => {
    if (typeof window !== 'undefined') {
      return resolveTabFromPath(window.location.pathname);
    }
    return 'overview';
  });

  const setActiveTab = useCallback(
    (tab: NavTab, params?: { articleId?: string; editionId?: string }) => {
      _setActiveTabRaw(tab);
      if (typeof window !== 'undefined') {
        const route = TAB_ROUTES[tab] || '/overview';
        const searchParams = new URLSearchParams(window.location.search);
        if (params?.articleId) searchParams.set('article', params.articleId);
        if (params?.editionId) searchParams.set('edition', params.editionId);
        const query = searchParams.toString();
        const targetUrl = query ? `${route}?${query}` : route;
        if (window.location.pathname !== route) {
          window.history.pushState(null, '', targetUrl);
        }
      }
    },
    []
  );

  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState<boolean>(false);

  // 100 Themes Management: Defaults to the standard newsprint theme (praja-vani-standard)
  const [activeThemeId, setActiveThemeId] = useState<string>(STANDARD_THEME_ID);

  const activeTheme = useMemo(() => getThemeById(activeThemeId), [activeThemeId]);
  const theme = activeTheme.mode;

  useEffect(() => {
    applyThemeToDocument(activeTheme);
  }, [activeTheme]);

  // Completely purge and disable localStorage and sessionStorage permanently from browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
        // Neutralize localStorage writes so no data is ever stored in browser local storage
        window.localStorage.setItem = () => {};
        window.sessionStorage.setItem = () => {};
      } catch {
        // ignore
      }
    }
  }, []);

  // Check active session on startup using cookie (persisting session without localStorage)
  useEffect(() => {
    let isMounted = true;
    async function restoreSession() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.user) {
            setCurrentUser(data.user);
          }
        }
      } catch (e) {
        console.warn('Session check note:', e);
      }
    }
    restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setActiveThemeId((prevId) => {
      const current = getThemeById(prevId);
      if (current.mode === 'light') {
        return 'tokyo-night'; // seamless toggle to primary dark
      } else {
        return STANDARD_THEME_ID; // toggle back to standard warm broadsheet
      }
    });
  }, []);

  const isReporter = currentUser?.role === 'reporter';
  const isEditor = !currentUser || currentUser.role === 'editor' || currentUser.role === 'admin';

  // Enforce role boundary: Reporters can ONLY access story submission portal (data entering to paper)
  useEffect(() => {
    if (isReporter) {
      if (activeTab !== 'reporter_portal') {
        _setActiveTabRaw('reporter_portal');
      }
    }
  }, [isReporter, activeTab]);

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
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isGeneratingEdition, setIsGeneratingEdition] = useState<boolean>(false);
  const [processingArticleId, setProcessingArticleId] = useState<string | null>(null);
  const [isSimulatingBreaking, setIsSimulatingBreaking] = useState<boolean>(false);

  // Sync with browser Back and Forward history buttons
  useEffect(() => {
    const handlePopState = () => {
      const tab = resolveTabFromPath(window.location.pathname);
      _setActiveTabRaw(tab);
      const params = new URLSearchParams(window.location.search);
      const art = params.get('article');
      const ed = params.get('edition');
      if (art) setSelectedArticleId(art);
      if (ed) setSelectedEditionId(ed);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const fetchEditionsData = useCallback(async () => {
    try {
      const res = await fetch('/api/editions');
      if (res.ok) {
        const eData = await res.json();
        setEditions(eData.editions || []);
      }
    } catch (e) {
      console.error('Failed to load editions:', e);
    }
  }, []);

  const fetchArticlesData = useCallback(async () => {
    try {
      const res = await fetch('/api/articles');
      if (res.ok) {
        const aData = await res.json();
        setArticles(aData.articles || []);
      }
    } catch (e) {
      console.error('Failed to load articles:', e);
    }
  }, []);

  const fetchAllData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setIsRefreshing(true);
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
          const list: User[] = uData.users || [];
          setUsers(list);
          setCurrentUser((prev) => {
            if (prev) {
              const fresh = list.find((u) => u.id === prev.id);
              if (fresh) return fresh;
              return prev;
            }
            return null;
          });
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

        if (isManualRefresh) {
          addToast({
            type: 'info',
            title: 'Newsroom State Synchronized',
            message: 'Telemetry refreshed across articles, active editions, and background jobs.',
            duration: 2000,
          });
        }
      } catch (err) {
        console.error('Failed to load operational state:', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedArticleId, selectedEditionId, addToast]
  );

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);



  const handleSwitchUser = async (userId: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        addToast({
          type: 'info',
          title: 'User Switched',
          message: `Acting as ${data.user.displayNameTelugu || data.user.displayName} (${data.user.role.toUpperCase()})`,
          duration: 2500,
        });
      }
    } catch (e) {
      console.error('Failed to switch user:', e);
    }
  };

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'x-user-id': currentUser?.id || '' },
        credentials: 'include',
      });
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.clear();
      } catch {
        // ignore
      }
    }
    setCurrentUser(null);
    setIsProfileModalOpen(false);
    addToast({
      type: 'info',
      title: 'Signed Out',
      message: 'Logged out of newsroom session.',
      duration: 2500,
    });
  }, [currentUser, addToast]);

  const handleTriggerArticleProcess = async (articleId: string, forceReprocess = false) => {
    setProcessingArticleId(articleId);
    addToast({
      type: 'loading',
      title: 'Triggering Dual-Model AI Pipeline',
      message: `Running Gemma 4 31B Classifier & Gemini 3.5 Flash-Lite Telugu Story Architect for ${articleId}...`,
      duration: 3500,
    });
    try {
      const res = await fetch(`/api/articles/${articleId}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || 'editor-chief',
        },
        body: JSON.stringify({ forceReprocess }),
      });
      if (res.ok) {
        addToast({
          type: 'success',
          title: 'Dual-Model Pipeline Queued! ⚡',
          message: 'Job dispatched to background worker pool. Live progress shown in Activity HUD.',
        });
      }
      await fetchAllData();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Pipeline Dispatch Failed',
        message: err instanceof Error ? err.message : 'Failed to invoke dual-model pipeline',
      });
    } finally {
      setProcessingArticleId(null);
    }
  };

  const handleUpdateArticle = async (articleId: string, patch: Record<string, unknown>) => {
    try {
      await fetch(`/api/articles/${articleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || 'editor-chief',
        },
        body: JSON.stringify(patch),
      });
      addToast({
        type: 'success',
        title: 'Editorial Changes Saved',
        message: `Article ${articleId} updated successfully.`,
        duration: 2500,
      });
      await fetchAllData();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Update Failed',
        message: err instanceof Error ? err.message : 'Unable to save editorial changes',
      });
    }
  };

  const handleDeleteArticle = async (articleId: string) => {
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentUser?.id || 'editor-chief',
        },
      });
      if (res.ok) {
        addToast({
          type: 'success',
          title: 'Submission Deleted',
          message: `Story ${articleId} permanently removed from newsroom.`,
          duration: 3000,
        });
        if (selectedArticleId === articleId) {
          setSelectedArticleId('');
        }
        await fetchAllData();
      } else {
        const err = await res.json();
        addToast({
          type: 'error',
          title: 'Delete Failed',
          message: err.error || 'Failed to delete article.',
        });
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: err instanceof Error ? err.message : 'Failed to delete article',
      });
    }
  };

  const handleCreateEdition = async (payload: {
    editionDate: string;
    editionTitleTelugu: string;
    targetPageCount: number;
    columnsPerPage: number;
  }) => {
    setIsGeneratingEdition(true);
    addToast({
      type: 'loading',
      title: 'Compiling Daily Newspaper Edition',
      message: `Composing ${payload.targetPageCount}-page ${payload.columnsPerPage}-column Telugu broadsheet layout...`,
      duration: 4000,
    });
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
        addToast({
          type: 'success',
          title: 'Edition Generated Successfully! 🗞️',
          message: `Created Edition #${data.edition?.editionNumber || 'New'} with layout manifest and preflight pass.`,
        });
      }
      await fetchAllData();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Edition Creation Failed',
        message: err instanceof Error ? err.message : 'Failed to generate edition',
      });
    } finally {
      setIsGeneratingEdition(false);
    }
  };

  const handleRegenerateEdition = async (editionId: string) => {
    setIsGeneratingEdition(true);
    addToast({
      type: 'loading',
      title: 'Re-Running Designer + Editor Loop',
      message: 'Autonomous iterative geometry optimization across Telugu column modules...',
      duration: 4000,
    });
    try {
      await fetch(`/api/editions/${editionId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || 'editor-chief',
        },
      });
      addToast({
        type: 'success',
        title: 'Layout Regeneration Complete! ✨',
        message: `Updated edition master plan and geometric medallions for ${editionId}.`,
      });
      await fetchAllData();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Regeneration Error',
        message: err instanceof Error ? err.message : 'Failed to re-run layout loop',
      });
    } finally {
      setIsGeneratingEdition(false);
    }
  };

  const handleUpdateSettings = async (partial: Partial<PublicationSettings>) => {
    try {
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
        addToast({
          type: 'success',
          title: 'Publication Settings Saved',
          message: 'Updated models, typography, and newspaper grid layout constraints.',
          duration: 2500,
        });
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Settings Update Failed',
        message: err instanceof Error ? err.message : 'Failed to persist settings',
      });
    }
  };

  // 1-Click Breaking News Simulation to make the UI immediately lively
  const handleSimulateBreakingNews = async () => {
    if (isSimulatingBreaking) return;
    setIsSimulatingBreaking(true);
    addToast({
      type: 'loading',
      title: 'Broadcasting Live Field Dispatch ⚡',
      message: 'Simulating breaking high-priority correspondent transmission to newsroom wire...',
      duration: 3000,
    });

    try {
      const breakingArticles = [
        {
          originalHeadline: 'తీరం దాటనున్న తీవ్ర తుఫాను · ఉత్తరాంధ్రలో హై అలర్ట్',
          originalBodyTelugu: 'బంగాళాఖాతంలో ఏర్పడిన తీవ్ర వాయుగుండం తుఫానుగా మారింది. విశాఖపట్నం, కాకినాడ తీరాల సమీపంలో గంటకు 110 కిలోమీటర్ల వేగంతో ఈదురుగాలులు వీచే అవకాశం ఉందని వాతావరణ శాఖ హెచ్చరించింది. తీరప్రాంత జిల్లాల్లో 24 గంటల కంట్రోల్ రూములు ఏర్పాటు చేశారు. మత్స్యకారులు సముద్రంలోకి వేటకు వెళ్లరాదని అధికారులు ఆదేశాలు జారీ చేశారు.',
          assignedCategory: 'General / Breaking News',
          assignedCategoryTelugu: 'తాజా వార్త',
          location: 'విశాఖపట్నం',
          district: 'Visakhapatnam',
          priorityScore: 98,
          photographUrl: 'https://images.unsplash.com/photo-1527482797697-8795b05a13fe?auto=format&fit=crop&w=900&q=80',
          photoCaptionTelugu: 'విశాఖ తీరంలో ఎగసిపడుతున్న రాకాసి అలలు · అప్రమత్తమైన అధికార యంత్రాంగం',
        },
        {
          originalHeadline: 'అమరావతి గ్రీన్ ఎనర్జీ ప్రాజెక్టుకు రూ. 12,000 కోట్ల పెట్టుబడులు',
          originalBodyTelugu: 'రాజధాని అమరావతిలో అంతర్జాతీయ సోలార్ మరియు గ్రీన్ హైడ్రోజన్ హబ్‌కు శంకుస్థాపన జరిగింది. రాబోయే రెండేళ్లలో 45,000 మంది యువతకు ఉపాధి అవకాశాలు లభిస్తాయని ప్రభుత్వం ప్రకటించింది. ఆధునిక బ్యాటరీ స్టోరేజ్ సిస్టమ్ ద్వారా 24 గంటల నిరంతర విద్యుత్ సరఫరాకు ప్రణాళికలు సిద్ధం చేశారు.',
          assignedCategory: 'Development and Infrastructure',
          assignedCategoryTelugu: 'అభివృద్ధి',
          location: 'అమరావతి',
          district: 'Guntur',
          priorityScore: 94,
          photographUrl: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=900&q=80',
          photoCaptionTelugu: 'అమరావతిలో ప్రతిపాదిత గ్రీన్ ఎనర్జీ సోలార్ పార్క్ నమూనా',
        },
      ];

      const chosen = breakingArticles[Math.floor(Math.random() * breakingArticles.length)];

      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || 'rep-vij-01',
        },
        body: JSON.stringify({
          originalHeadline: chosen.originalHeadline,
          originalBodyTelugu: chosen.originalBodyTelugu,
          assignedCategory: chosen.assignedCategory,
          assignedCategoryTelugu: chosen.assignedCategoryTelugu,
          location: chosen.location,
          district: chosen.district,
          priorityScore: chosen.priorityScore,
          assets: [
            {
              assetType: 'photograph',
              assetUrl: chosen.photographUrl,
              captionTelugu: chosen.photoCaptionTelugu,
              photographerCredit: 'పీటీఐ ప్రత్యేక ఫోటో',
              resolutionDpi: 300,
              isPrimaryPhoto: true,
            },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newArtId = data.article?.id;
        addToast({
          type: 'success',
          title: '🚨 Breaking Wire Story Received!',
          message: `"${chosen.originalHeadline}" posted with Priority ${chosen.priorityScore}/100. AI pipeline launched!`,
          duration: 5000,
        });

        await fetchAllData();

        if (newArtId) {
          setSelectedArticleId(newArtId);
          await handleTriggerArticleProcess(newArtId, true);
        }
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Simulation Failed',
        message: err instanceof Error ? err.message : 'Could not inject breaking dispatch',
      });
    } finally {
      setIsSimulatingBreaking(false);
    }
  };

  const activeEdition =
    editions.find((e) => e.id === selectedEditionId) || editions[0] || null;
  const activeArticle =
    articles.find((a) => a.id === selectedArticleId) || articles[0] || null;

  const filteredSubmissions = articles.filter((a) => {
    // If user is a reporter, they can ONLY see their own submissions
    if (isReporter && currentUser) {
      const matchesReporter =
        a.reporterId === currentUser.id ||
        (Boolean(a.reporterName) && a.reporterName?.toLowerCase() === currentUser.displayName.toLowerCase()) ||
        (Boolean(currentUser.email && a.reporterName) && a.reporterName?.toLowerCase() === currentUser.email?.toLowerCase());
      if (!matchesReporter) return false;
    }

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

  // Strict Login Gate: Users have NO access to the website without logging in
  if (!currentUser) {
    return (
      <LoginGateView
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          fetchAllData();
        }}
      />
    );
  }

  const currentNavTabs: [NavTab, string, string][] = isReporter
    ? [
        ['reporter_portal', 'వార్తల నమోదు డెస్క్ (Story Entry)', '✍️'],
      ]
    : [
        ['submissions', 'కథనాలు & వార్తా డెస్క్ (Submissions)', '📑'],
        ['preview', 'దినపత్రిక పేజీ కూర్పు (Broadsheet)', '📜'],
        ['editions', 'దినపత్రిక ముద్రణలు (Editions)', '📰'],
        ['reporters', 'జర్నలిస్టుల నిర్వహణ (Reporters)', '👥'],
        ['overview', 'సాధారణ వివరాలు (Overview)', '📊'],
      ];

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 ${
        theme === 'light' ? 'bg-[#F4F1EA] text-stone-900' : 'bg-[#080C14] text-[#E2E8F0]'
      }`}
    >
      {/* ============================================================== */}
      {/* MASTER EXECUTIVE NEWSROOM NAVIGATION BAR                       */}
      {/* ============================================================== */}
      <header
        className={`sticky top-0 z-40 backdrop-blur-xl border-b shadow-md transition-colors duration-200 ${
          theme === 'light'
            ? 'bg-white/95 border-stone-200 shadow-stone-200/50'
            : 'bg-[#0A0F1A]/95 border-slate-800/80 shadow-black/30'
        }`}
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="#overview"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab(isReporter ? 'reporter_portal' : 'submissions');
              }}
              className="group flex items-center gap-3 text-decoration-none"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 via-red-600 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-950/60 group-hover:scale-105 transition-transform">
                <Newspaper className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xl font-black tracking-tight font-telugu-sans ${
                      theme === 'light' ? 'text-rose-700' : 'text-white'
                    }`}
                  >
                    ప్రజా వాణి
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-widest font-mono font-semibold hidden sm:inline ${
                      theme === 'light' ? 'text-stone-500' : 'text-slate-400'
                    }`}
                  >
                    PRAJA VANI
                  </span>
                  <span
                    className={`text-[10px] font-telugu-sans font-medium px-2 py-0.5 rounded-full border hidden md:inline ${
                      theme === 'light'
                        ? 'bg-stone-100 border-stone-300 text-stone-700'
                        : 'bg-slate-800/80 border-slate-700/60 text-slate-300'
                    }`}
                  >
                    {settings.editionCityTelugu}
                  </span>
                </div>
                <div
                  className={`text-[10px] font-mono flex items-center gap-1.5 -mt-0.5 ${
                    theme === 'light' ? 'text-stone-500' : 'text-slate-400'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  ఆంధ్రప్రదేశ్ &amp; తెలంగాణ సమగ్ర దినపత్రిక
                </div>
              </div>
            </a>
          </div>

          {/* Desktop Segmented Navigation */}
          <nav
            aria-label="Primary Navigation"
            className={`hidden md:flex items-center p-1 rounded-xl shadow-inner gap-1 text-xs border ${
              theme === 'light'
                ? 'bg-stone-100 border-stone-200'
                : 'bg-slate-900/90 border-slate-800'
            }`}
          >
            {currentNavTabs.map(([tabKey, label, icon]) => {
              const isActive = activeTab === tabKey;
              return (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setActiveTab(tabKey)}
                  className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap font-medium ${
                    isActive
                      ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white font-bold shadow-sm shadow-rose-950/70 border border-rose-500/40'
                      : theme === 'light'
                      ? 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <span className="text-xs">{icon}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* 100 Themes Gallery Button */}
            <button
              type="button"
              onClick={() => setIsThemeModalOpen(true)}
              className={`px-3 py-1.5 rounded-xl border transition-all flex items-center gap-2 cursor-pointer shadow-sm text-xs font-medium ${
                theme === 'light'
                  ? 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-800'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200'
              }`}
              title="100 థీమ్స్ గ్యాలరీ — వర్ణ శైలులను అన్వేషించండి"
            >
              <Palette className="w-4 h-4 text-rose-500" />
              <span className="hidden sm:inline font-telugu-sans font-semibold">
                {activeTheme.id === STANDARD_THEME_ID ? 'ప్రామాణిక శైలి' : activeTheme.nameTelugu.split(' ')[0]}
              </span>
              <span
                className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                style={{ backgroundColor: activeTheme.colors.primary }}
              />
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-500 font-bold hidden md:inline">
                100
              </span>
            </button>

            {/* Quick Mode Toggle Button (Light / Dark) */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-700'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-amber-400'
              }`}
              title={
                theme === 'light'
                  ? 'డార్క్ మోడ్‌కి మారండి (Switch to Dark Mode)'
                  : 'లైట్ మోడ్‌కి మారండి (Switch to Light Mode)'
              }
            >
              {theme === 'light' ? <Moon className="w-4 h-4 text-stone-700" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>

            {/* Google Account Profile Button */}
            <div
              className={`flex items-center gap-1.5 rounded-xl p-1 text-xs shadow-sm border transition ${
                theme === 'light'
                  ? 'bg-stone-100 border-stone-200 text-stone-800'
                  : 'bg-slate-900/90 border-slate-800 text-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-lg transition cursor-pointer text-left ${
                  theme === 'light' ? 'hover:bg-stone-200/70' : 'hover:bg-slate-800/80'
                }`}
                title="Google Account & Profile"
              >
                <div className="relative shrink-0">
                  {currentUser?.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.displayName}
                      className="w-5 h-5 rounded-full object-cover border border-rose-500/60"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-rose-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
                      {currentUser?.displayName ? currentUser.displayName.charAt(0) : 'G'}
                    </div>
                  )}
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-semibold text-xs max-w-[120px] sm:max-w-[160px] truncate ${
                        theme === 'light' ? 'text-stone-900' : 'text-slate-200'
                      }`}
                    >
                      {currentUser?.displayNameTelugu || currentUser?.displayName || 'Google Account'}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider bg-rose-950/60 text-rose-300 border border-rose-800/50">
                      {currentUser?.role === 'editor' ? 'ప్రధాన సంపాదకులు' : 'రిపోర్టర్'}
                    </span>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  theme === 'light'
                    ? 'text-stone-500 hover:text-rose-600 hover:bg-stone-200/80'
                    : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800/80'
                }`}
                title="ఖాతా నుండి నిష్క్రమించండి (Sign Out)"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* If Editor, show button to write story / reporter portal */}
            {isEditor && (
              <button
                type="button"
                onClick={() => setActiveTab('reporter_portal')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
                  activeTab === 'reporter_portal'
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-rose-950/70 border border-rose-400'
                    : 'bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 text-white shadow-rose-950/50'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">వార్త నమోదు (Submit Story)</span>
                <span className="sm:hidden">రాయండి</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Slim Broadcast Ticker with Audio & Text-to-Speech */}
      <BreakingNewsTicker
        articles={articles}
        onSelectArticle={(id) => {
          setSelectedArticleId(id);
          setActiveTab('processing');
        }}
        onSimulateBreaking={handleSimulateBreakingNews}
        isSimulating={isSimulatingBreaking}
      />

      {/* Mobile Navigation Tabs */}
      <div
        className={`md:hidden flex items-center gap-2 overflow-x-auto px-4 py-2 border-b text-xs ${
          theme === 'light' ? 'bg-stone-100 border-stone-200' : 'bg-slate-900/90 border-slate-800'
        }`}
      >
        {currentNavTabs.map(([tabKey, label]) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setActiveTab(tabKey)}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap shrink-0 font-medium cursor-pointer transition-colors ${
              activeTab === tabKey
                ? 'bg-rose-600 text-white shadow-xs'
                : theme === 'light'
                ? 'text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Real-Time Live Activity HUD - only in overview and processing tabs */}
        {(activeTab === 'overview' || activeTab === 'processing') && (
          <LiveActivityHud
            jobs={jobs}
            aiConfigured={aiConfigured}
            theme={theme}
            onRefresh={() => fetchAllData(true)}
            onJobCompleted={() => {
              fetchEditionsData();
              fetchArticlesData();
            }}
            onSimulateBreakingNews={handleSimulateBreakingNews}
            isSimulating={isSimulatingBreaking}
          />
        )}

        {/* ============================================================== */}
        {/* VIEW A: OVERVIEW (METRIC CARDS + STORIES QUEUE + RECENT JOBS)   */}
        {/* ============================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* 7 Glowing Operational Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {/* Metric 1 */}
              <div
                onClick={() => setActiveTab('submissions')}
                className="glass-card-interactive p-3.5 border border-slate-800 rounded-xl cursor-pointer group"
              >
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Submissions</div>
                <div className="text-2xl font-black font-mono-tabular text-white mt-1 group-hover:text-amber-300 transition-colors">
                  {articles.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                  <span>All Bureaus</span>
                  <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-amber-400 transition-colors" />
                </div>
              </div>

              {/* Metric 2 */}
              <div
                onClick={() => {
                  setFilterStatus('processed');
                  setActiveTab('submissions');
                }}
                className="glass-card-interactive p-3.5 border border-slate-800 rounded-xl cursor-pointer group"
              >
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Processed</div>
                <div className="text-2xl font-black font-mono-tabular text-emerald-400 mt-1 group-hover:text-emerald-300 transition-colors">
                  {totalProcessedCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                  <span>Ready for Layout</span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                </div>
              </div>

              {/* Metric 3 */}
              <div
                onClick={() => {
                  setFilterStatus('draft');
                  setActiveTab('submissions');
                }}
                className="glass-card-interactive p-3.5 border border-slate-800 rounded-xl cursor-pointer group"
              >
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Awaiting</div>
                <div className="text-2xl font-black font-mono-tabular text-amber-400 mt-1 group-hover:text-amber-300 transition-colors">
                  {awaitingCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Draft / In Queue</div>
              </div>

              {/* Metric 4 */}
              <div
                onClick={() => {
                  setFilterStatus('flagged_hold');
                  setActiveTab('submissions');
                }}
                className="glass-card-interactive p-3.5 border border-slate-800 rounded-xl cursor-pointer group"
              >
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Flagged / Held</div>
                <div className="text-2xl font-black font-mono-tabular text-rose-400 mt-1 group-hover:text-rose-300 transition-colors">
                  {flaggedCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-rose-500" />
                  <span>Safety Policy Hold</span>
                </div>
              </div>

              {/* Metric 5 */}
              <div
                onClick={() => setActiveTab('editions')}
                className="glass-card-interactive p-3.5 border border-slate-800 rounded-xl cursor-pointer group"
              >
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Active Edition</div>
                <div className="text-2xl font-black font-mono-tabular text-orange-400 mt-1 group-hover:text-orange-300 transition-colors">
                  #{activeEdition?.editionNumber || 104}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-mono-tabular">
                  {activeEdition?.editionDate || '2026-10-19'}
                </div>
              </div>

              {/* Metric 6 */}
              <div
                onClick={() => setActiveTab('preview')}
                className="glass-card-interactive p-3.5 border border-slate-800 rounded-xl cursor-pointer group"
              >
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Pages Generated</div>
                <div className="text-2xl font-black font-mono-tabular text-cyan-400 mt-1 group-hover:text-cyan-300 transition-colors">
                  {activeEdition?.actualPageCount || 2}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {settings.columnsPerPage}-Col Broadsheet
                </div>
              </div>

              {/* Metric 7 */}
              <div
                onClick={() => setActiveTab('preview')}
                className="glass-card-interactive p-3.5 border border-slate-800 rounded-xl cursor-pointer group"
              >
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">PDF Status</div>
                <div className="text-lg font-black font-mono-tabular uppercase text-emerald-400 mt-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {activeEdition?.status || 'PUBLISHED'}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">11/11 Preflight OK</div>
              </div>
            </div>

            {/* Split Workspace: Active Stories Queue + Background Worker Telemetry */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Left 7 Columns: Active Stories & Dispatches */}
              <div className="lg:col-span-7 glass-card p-5 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h2 className="text-base font-bold text-white flex items-center gap-2">
                        <span>Active Telugu Stories &amp; Editorial Queue</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          {articles.length} Stories
                        </span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Traceable from reporter dispatch through Gemma 4 31B classification to Gemini 3.5 typesetting
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('preview')}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
                    >
                      <Newspaper className="w-3.5 h-3.5 text-amber-400" />
                      Open Broadsheet
                    </button>
                  </div>

                  <div className="divide-y divide-slate-800/80">
                    {articles.slice(0, 6).map((art) => {
                      const isRowProcessing = processingArticleId === art.id;
                      return (
                        <div
                          key={art.id}
                          className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-850/60 px-2 rounded-lg transition-colors group"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              <span className="font-telugu-sans font-bold text-amber-400">
                                {art.assignedCategoryTelugu}
                              </span>
                              <span className="text-slate-600">·</span>
                              <span className="font-telugu-sans text-slate-300 font-medium">{art.location}</span>
                              <span className="text-slate-600">·</span>
                              <span className="text-slate-400">{art.reporterName || art.reporterId}</span>
                              <span className="text-slate-600">·</span>
                              <span className="font-mono-tabular text-slate-300 font-medium">
                                Pri {art.priorityScore}/100
                              </span>
                              <span className="text-slate-600">·</span>
                              <span
                                className={`font-mono-tabular font-bold text-[11px] uppercase px-1.5 py-0.5 rounded ${
                                  art.status === 'flagged_hold'
                                    ? 'bg-rose-950/70 text-rose-300 border border-rose-800'
                                    : art.status === 'processed' || art.status === 'approved'
                                    ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {art.status}
                              </span>
                            </div>
                            <h3 className="font-telugu-sans font-bold text-sm text-slate-100 truncate group-hover:text-amber-300 transition-colors">
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
                              className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-855 hover:bg-slate-750 text-slate-200 border border-slate-700 cursor-pointer whitespace-nowrap transition-colors"
                            >
                              Inspect AI
                            </button>
                            <button
                              type="button"
                              disabled={isRowProcessing}
                              onClick={() => handleTriggerArticleProcess(art.id, true)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-md bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 cursor-pointer whitespace-nowrap transition-colors flex items-center gap-1 disabled:opacity-50"
                            >
                              <Play className={`w-3 h-3 ${isRowProcessing ? 'animate-spin' : ''}`} />
                              <span>{isRowProcessing ? 'Running...' : 'Process'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Action Strip */}
                <div className="border-t border-slate-800 pt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-slate-400">
                    All {activeEdition?.layoutDiagnostics.placedArticles || 5} eligible stories placed in Edition #{activeEdition?.editionNumber || 104}; {flaggedCount} high-risk story held.
                  </span>
                  {activeEdition && (
                    <button
                      type="button"
                      onClick={async () => {
                        addToast({
                          type: 'loading',
                          title: 'Downloading Broadsheet PDF',
                          message: `Retrieving edition ${activeEdition.editionNumber}...`,
                          duration: 2500,
                        });
                        try {
                          const p = await fetchAndTriggerCookieSafePdfDownload(activeEdition.id);
                          addToast({
                            type: 'success',
                            title: 'Broadsheet PDF Downloaded! 🖨️',
                            message: `${p.filename} (${(p.sizeBytes / 1024).toFixed(0)} KB) saved to device.`,
                            duration: 2500,
                          });
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : 'PDF download error';
                          setPdfDownloadError(msg);
                          addToast({ type: 'error', title: 'PDF Download Failed', message: msg });
                        }
                      }}
                      className="font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Print-Ready Edition PDF →
                    </button>
                  )}
                </div>
              </div>

              {/* Right 5 Columns: Background Worker Queue */}
              <div className="lg:col-span-5 glass-card p-5 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h2 className="text-base font-bold text-white flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-cyan-400" />
                        <span>Background AI Workers</span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Editorial processing, edition planning &amp; PDF generation jobs
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchAllData(true)}
                      className="p-1.5 text-slate-400 hover:text-white border border-slate-700 bg-slate-900 rounded-lg cursor-pointer transition-colors"
                      aria-label="Refresh Jobs"
                      title="Force refresh newsroom telemetry"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
                    </button>
                  </div>

                  <div className="divide-y divide-slate-800/80 max-h-[340px] overflow-y-auto space-y-1">
                    {jobs.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 text-xs">
                        No background jobs currently in history. Click <strong>⚡ Test Breaking News</strong> above to trigger one!
                      </div>
                    ) : (
                      jobs.slice(0, 8).map((job) => (
                        <div key={job.id} className="py-2.5 text-xs space-y-1.5">
                          <div className="flex items-center justify-between font-mono-tabular">
                            <span className="font-semibold text-slate-200 truncate max-w-[200px]">
                              {job.jobType} → {job.targetId}
                            </span>
                            <span
                              className={`uppercase font-bold text-[11px] px-2 py-0.5 rounded ${
                                job.status === 'completed'
                                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                                  : job.status === 'failed'
                                  ? 'bg-red-950/80 text-red-300 border border-red-800'
                                  : 'bg-amber-950/80 text-amber-300 border border-amber-800 animate-pulse'
                              }`}
                            >
                              {job.status} ({job.progressPercent}%)
                            </span>
                          </div>

                          {/* Mini Progress Bar for Job */}
                          <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
                            <div
                              className={`h-full transition-all duration-300 ${
                                job.status === 'completed'
                                  ? 'bg-emerald-500'
                                  : job.status === 'failed'
                                  ? 'bg-red-500'
                                  : 'bg-gradient-to-r from-amber-500 to-orange-500'
                              }`}
                              style={{ width: `${Math.max(5, job.progressPercent)}%` }}
                            />
                          </div>

                          <p className="text-slate-300 leading-snug text-[11px]">{job.stepDescription}</p>
                          <div className="text-[10px] text-slate-500 font-mono-tabular flex items-center justify-between">
                            <span>Models: {job.modelAId} + {job.modelBId}</span>
                            {job.cacheHit && (
                              <span className="text-cyan-400 font-semibold">⚡ CACHE HIT</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Want to test the live reporter-to-PDF flow?</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('reporter_portal')}
                    className="font-bold text-rose-400 hover:text-rose-300 cursor-pointer transition-colors"
                  >
                    Open Reporter Portal →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW B: REPORTER SUBMISSIONS (EDITORIAL QUEUE WITH FILTERS)     */}
        {/* ============================================================== */}
        {activeTab === 'submissions' && (
          <div className="glass-card p-6 border border-slate-800/90 rounded-2xl space-y-5 shadow-xl shadow-black/40">
            {/* Executive Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-bold text-white tracking-tight font-telugu-sans">
                    విలేకరుల కథనాల డెస్క్ (Submissions Queue)
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                    {filteredSubmissions.length} / {articles.length} కథనాలు
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  పత్రిక ప్రచురణ కొరకు వివిధ జిల్లాల విలేకరులు సమర్పించిన తాజా వార్తా కథనాలు
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('reporter_portal')}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white hover:from-rose-500 hover:to-red-500 flex items-center gap-2 cursor-pointer shadow-md shadow-rose-950/60 active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>నూతన వార్త నమోదు</span>
                </button>
              </div>
            </div>

            {/* Streamlined Filter & Search Command Strip */}
            <div className="bg-[#0B101D] p-3 border border-slate-800/90 rounded-xl flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  placeholder="శీర్షిక లేదా జిల్లా పేరుతో శోధించండి (విజయవాడ, గుంటూరు...)..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs font-telugu-sans bg-slate-900 border border-slate-700/80 text-slate-200 rounded-lg focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30 placeholder-slate-500"
                />
              </div>

              {/* Reporter Filter */}
              <select
                value={filterReporter}
                onChange={(e) => setFilterReporter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700/80 text-slate-200 rounded-lg focus:outline-none focus:border-rose-500 cursor-pointer"
              >
                <option value="all">అన్ని జిల్లాల విలేకరులు</option>
                {users
                  .filter((u) => u.role === 'reporter')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayNameTelugu || u.displayName} ({u.district})
                    </option>
                  ))}
              </select>

              {/* Section Filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700/80 text-slate-200 rounded-lg focus:outline-none focus:border-rose-500 cursor-pointer font-telugu-sans"
              >
                <option value="all">పత్రిక విభాగాలు (అన్నీ)</option>
                {settings.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.teluguLabel}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700/80 text-slate-200 rounded-lg focus:outline-none focus:border-rose-500 cursor-pointer"
              >
                <option value="all">అన్ని స్థితులు (All Statuses)</option>
                <option value="processed">పరిశీలన పూర్తి (ప్రచురణకు సిద్ధం)</option>
                <option value="flagged_hold">సంపాదక సమీక్షలో ఉంది (Hold)</option>
                <option value="approved">సంపాదకుల ఆమోదం</option>
                <option value="draft">ముసాయిదా (Draft)</option>
                <option value="processing">పరిశీలన జరుగుతోంది</option>
                <option value="failed">విఫలమైంది</option>
              </select>

              {/* Clear Filters Reset */}
              {(filterReporter !== 'all' || filterCategory !== 'all' || filterStatus !== 'all' || filterLocation.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterReporter('all');
                    setFilterCategory('all');
                    setFilterStatus('all');
                    setFilterLocation('');
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 cursor-pointer"
                >
                  ఫిల్టర్లను రీసెట్ చేయండి
                </button>
              )}
            </div>

            {/* Publication-Grade Submissions Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800/80">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">వార్తా శీర్షిక &amp; వివరాలు</th>
                    <th className="py-3 px-3">విభాగం &amp; బ్యూరో</th>
                    <th className="py-3 px-3">విలేకరి &amp; చిత్రాలు</th>
                    <th className="py-3 px-3 text-right">సమయం</th>
                    <th className="py-3 px-3 text-right">ప్రాధాన్యత</th>
                    <th className="py-3 px-3">స్థితి</th>
                    <th className="py-3 px-4 text-right">చర్యలు</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 text-xs font-telugu-sans">
                        ఎంచుకున్న ఫిల్టర్లకు అనుగుణంగా ఎటువంటి కథనాలు లేవు.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((art) => {
                      const isRowProcessing = processingArticleId === art.id;
                      return (
                        <tr key={art.id} className="hover:bg-slate-850/40 transition-colors group">
                          <td className="py-3.5 px-4 max-w-md">
                            <div className="font-telugu-sans font-bold text-sm text-slate-100 group-hover:text-amber-300 transition-colors leading-snug">
                              {art.primaryHeadlineTelugu || art.originalHeadline || 'శీర్షిక లేని వార్త'}
                            </div>
                            <div className="font-telugu-serif text-xs text-slate-400 line-clamp-1 mt-1">
                              {art.summaryTelugu || art.originalBodyTelugu}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 font-telugu-sans">
                            <span className="font-semibold text-slate-200 text-xs inline-block">
                              {art.assignedCategoryTelugu}
                            </span>
                            <div className="text-slate-400 text-[11px] mt-0.5">
                              {art.location} · {art.district}
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="font-medium text-slate-200">{art.reporterName || art.reporterId}</div>
                            <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                              Rev #{art.currentRevision} · {art.assets?.length || 0} Photo(s)
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono text-slate-400 text-[11px]">
                            {art.submissionTime.slice(5, 16).replace('T', ' ')}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold">
                            <span className={art.priorityScore >= 90 ? 'text-amber-400' : 'text-slate-300'}>
                              {art.priorityScore}/100
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`font-mono uppercase font-bold text-[10.5px] px-2 py-0.5 rounded-full inline-block ${
                                art.status === 'flagged_hold'
                                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                  : art.status === 'processed' || art.status === 'approved'
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {art.status}
                            </span>
                            {art.validationWarnings.length > 0 && (
                              <div className="text-amber-400 flex items-center gap-1 mt-1 text-[11px]">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>{art.validationWarnings.length} alert(s)</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedArticleId(art.id);
                                  setActiveTab('processing');
                                }}
                                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800/80 text-slate-200 border border-slate-700 hover:bg-slate-700 cursor-pointer whitespace-nowrap transition-colors flex items-center gap-1 font-telugu-sans"
                              >
                                <Eye className="w-3 h-3 text-slate-400" />
                                <span>పరిశీలన</span>
                              </button>
                              <button
                                type="button"
                                disabled={isRowProcessing}
                                onClick={() => handleTriggerArticleProcess(art.id, true)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/40 hover:bg-rose-600/30 cursor-pointer whitespace-nowrap transition-colors flex items-center gap-1 disabled:opacity-50 font-telugu-sans"
                              >
                                <Play className={`w-3 h-3 ${isRowProcessing ? 'animate-spin' : ''}`} />
                                <span>{isRowProcessing ? '...' : 'పేజీకి అమర్చండి'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const title = art.primaryHeadlineTelugu || art.originalHeadline || art.id;
                                  if (
                                    window.confirm(
                                      `ఈ కథనాన్ని ఖచ్చితంగా తొలగించాలనుకుంటున్నారా?\n\n"${title}"\n\nఇది పత్రిక నుండి పూర్తిగా తొలగించబడుతుంది.`
                                    )
                                  ) {
                                    handleDeleteArticle(art.id);
                                  }
                                }}
                                className="p-1.5 text-xs font-medium rounded-lg bg-slate-800/60 text-slate-400 border border-slate-700 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-800/80 cursor-pointer transition-colors"
                                title="కథనాన్ని తొలగించండి"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW C: ARTICLE PROCESSING (DUAL-MODEL INSPECTOR)               */}
        {/* ============================================================== */}
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
            onDeleteArticle={handleDeleteArticle}
          />
        )}

        {/* ============================================================== */}
        {/* VIEW D: EDITION MANAGEMENT                                     */}
        {/* ============================================================== */}
        {activeTab === 'editions' && (
          <EditionManagerView
            editions={editions}
            settings={settings}
            theme={theme}
            onCreateEdition={handleCreateEdition}
            onRegenerateEdition={handleRegenerateEdition}
            onUpdateSettings={handleUpdateSettings}
          />
        )}

        {/* ============================================================== */}
        {/* VIEW E: NEWSPAPER PREVIEW (BROADSHEET COMPOSITOR & PDF)         */}
        {/* ============================================================== */}
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

        {/* ============================================================== */}
        {/* VIEW F: REPORTERS MANAGEMENT (EDITOR ONLY)                     */}
        {/* ============================================================== */}
        {activeTab === 'reporters' && currentUser && isEditor && (
          <ReportersManagementView currentUser={currentUser} theme={theme} />
        )}

        {/* ============================================================== */}
        {/* REPORTER PORTAL VIEW                                           */}
        {/* ============================================================== */}
        {activeTab === 'reporter_portal' && currentUser && (
          <ReporterPortalView
            theme={theme}
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
            onDeleteArticle={handleDeleteArticle}
          />
        )}
      </main>

      {/* Newspaper Newsroom Footer */}
      <footer
        className={`border-t px-6 py-4 mt-auto text-xs transition-colors duration-200 ${
          theme === 'light'
            ? 'bg-white border-stone-200 text-stone-600'
            : 'border-slate-800 bg-[#0B1120]/80 text-slate-500'
        }`}
      >
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>
              ప్రజా వాణి (Praja Vani) సమగ్ర తెలుగు దినపత్రిక ప్రచురణ వ్యవస్థ · డిజిటల్ న్యూస్‌రూమ్
            </span>
          </div>
          <div className="font-telugu-sans font-medium text-slate-400">
            ఆంధ్రప్రదేశ్ &amp; తెలంగాణ సమగ్ర దినపత్రిక
          </div>
        </div>
      </footer>

      {/* Cookie-Safe Print-Ready PDF Inspector Modal */}
      <PdfExportInspectorModal
        payload={pdfInspectorPayload}
        error={pdfDownloadError}
        onClose={() => {
          setPdfInspectorPayload(null);
          setPdfDownloadError(null);
        }}
      />

      {/* Google Account Login & Newsroom Bureau Profile Modal */}
      <GoogleAccountProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        users={users}
        onUserChange={(newUser) => {
          setCurrentUser(newUser);
          setUsers((prev) => {
            const idx = prev.findIndex((u) => u.id === newUser.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = newUser;
              return copy;
            }
            return [newUser, ...prev];
          });
        }}
        onLogout={handleLogout}
      />

      {/* 100 Themes Selection Modal */}
      <ThemeSelectorModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        currentThemeId={activeThemeId}
        onSelectTheme={(selected) => {
          setActiveThemeId(selected.id);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
