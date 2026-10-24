import React, { useState, useEffect } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Zap,
  CheckCircle2,
  Clock,
  Sparkles,
  Newspaper,
} from 'lucide-react';
import type { AIProcessingJob } from '../shared/types.ts';

interface LiveActivityHudProps {
  jobs?: AIProcessingJob[];
  aiConfigured?: boolean;
  theme?: 'light' | 'dark';
  onRefresh: () => void;
  onJobCompleted?: () => void;
  onSimulateBreakingNews?: () => void;
  isSimulating?: boolean;
}

export const LiveActivityHud: React.FC<LiveActivityHudProps> = ({
  jobs = [],
  theme = 'dark',
  onRefresh,
  onJobCompleted,
  onSimulateBreakingNews,
  isSimulating = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localJobs, setLocalJobs] = useState<AIProcessingJob[]>(jobs);

  useEffect(() => {
    if (jobs && jobs.length > 0 && localJobs.length === 0) {
      setLocalJobs(jobs);
    }
  }, [jobs]);

  useEffect(() => {
    let isPolling = false;
    const timer = setInterval(async () => {
      if (isPolling) return;
      isPolling = true;
      try {
        const res = await fetch('/api/jobs');
        if (res.ok) {
          const data = await res.json();
          const next: AIProcessingJob[] = data.jobs || [];
          setLocalJobs((prev) => {
            const newlyFinished = next.some((nj) => {
              const pj = prev.find((p) => p.id === nj.id);
              return (
                pj &&
                (pj.status === 'active' || pj.status === 'queued') &&
                (nj.status === 'completed' || nj.status === 'failed')
              );
            });
            if (newlyFinished && onJobCompleted) {
              onJobCompleted();
            }
            return next;
          });
        }
      } catch {
        // ignore
      } finally {
        isPolling = false;
      }
    }, 1200);

    return () => clearInterval(timer);
  }, [onJobCompleted]);

  const activeJob = localJobs.find((j) => j.status === 'active' || j.status === 'queued') || null;
  const recentCompleted = localJobs.filter((j) => j.status === 'completed')[0] || null;

  const isLight = theme === 'light';

  const getTeluguJobTitle = (jobType: string) => {
    switch (jobType) {
      case 'pdf_generation':
        return 'దినపత్రిక పి.డి.ఎఫ్ ముద్రణ ప్రక్రియ';
      case 'edition_planning':
        return 'దినపత్రిక పేజీల లేఅవుట్ కూర్పు';
      case 'editorial_processing':
        return 'వార్తా కథనం పరిశీలన & శీర్షిక అమరిక';
      default:
        return 'వార్తా కార్యకలాపం';
    }
  };

  return (
    <div className="relative z-20">
      <div
        className={`p-3.5 rounded-2xl border transition-colors ${
          isLight
            ? 'bg-white border-stone-300 shadow-sm'
            : 'bg-slate-900/90 border-slate-800 shadow-xl shadow-black/40'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Newsroom Status Indicator */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <span
                className={`w-3 h-3 rounded-full ${
                  activeJob ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'
                }`}
              />
              <span
                className={`absolute w-2 h-2 rounded-full ${
                  activeJob ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
              />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold tracking-wide uppercase flex items-center gap-1.5 font-telugu-sans ${
                    isLight ? 'text-stone-900' : 'text-white'
                  }`}
                >
                  <Newspaper className="w-3.5 h-3.5 text-rose-500" />
                  డిజిటల్ సంపాదక వ్యవస్థ (Digital Newsroom)
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    isLight
                      ? 'bg-stone-100 border-stone-300 text-stone-700'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  లైవ్ డెస్క్
                </span>
              </div>

              <div
                className={`text-xs flex items-center gap-2 mt-0.5 ${
                  isLight ? 'text-stone-600' : 'text-slate-400'
                }`}
              >
                {activeJob ? (
                  <span className="text-rose-500 font-bold flex items-center gap-1.5">
                    <Activity className="w-3 h-3 text-rose-500 animate-pulse" />
                    {getTeluguJobTitle(activeJob.jobType)} ({activeJob.progressPercent}%) —{' '}
                    {activeJob.stepDescription}
                  </span>
                ) : recentCompleted ? (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    తాజా ప్రక్రియ విజయవంతంగా పూర్తయింది.
                  </span>
                ) : (
                  <span>న్యూస్‌రూమ్ కార్యకలాపాలు సిద్ధంగా ఉన్నాయి.</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {onSimulateBreakingNews && (
              <button
                type="button"
                onClick={onSimulateBreakingNews}
                disabled={isSimulating}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSimulating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>నమోదవుతోంది...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>⚡ టెస్ట్ బ్రేకింగ్ న్యూస్</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1 cursor-pointer ${
                isLight
                  ? 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-700'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
            >
              <span>వివరాలు</span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onRefresh}
              className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                isLight
                  ? 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-700'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
              title="స్థితిని రీఫ్రెష్ చేయండి"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Live Active Progress Bar - smoothly animated without refreshing or unmounting */}
        {activeJob && (
          <div className="mt-3 pt-2 border-t border-slate-800/30">
            <div className="flex justify-between text-xs font-mono font-semibold mb-1">
              <span className={isLight ? 'text-stone-700' : 'text-slate-300'}>
                {activeJob.stepDescription}
              </span>
              <span className="text-rose-500 font-bold">{activeJob.progressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800/20 rounded-full overflow-hidden border border-slate-700/20">
              <div
                className="h-full bg-gradient-to-r from-rose-600 via-amber-500 to-emerald-500 rounded-full"
                style={{
                  width: `${Math.max(5, activeJob.progressPercent)}%`,
                  transition: 'width 0.4s ease-in-out',
                }}
              />
            </div>
          </div>
        )}

        {/* Expandable Activity Drawer */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-slate-800/40 text-xs">
            <div
              className={`rounded-xl p-3 border max-h-48 overflow-y-auto space-y-2 ${
                isLight
                  ? 'bg-stone-50 border-stone-300 text-stone-800'
                  : 'bg-slate-950/90 border-slate-800 text-slate-300'
              }`}
            >
              <div className="text-[11px] font-bold pb-1 border-b border-slate-800/30 flex items-center justify-between">
                <span>తాజా న్యూస్‌రూమ్ కార్యకలాపాలు</span>
                <span className="text-emerald-500 flex items-center gap-1 font-bold">
                  <Sparkles className="w-3 h-3" /> లైవ్
                </span>
              </div>

              {localJobs.slice(0, 5).map((job) => (
                <div key={job.id} className="leading-snug py-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                      <strong>{getTeluguJobTitle(job.jobType)}</strong>
                    </span>
                    <span className="font-mono text-rose-500 font-bold">
                      {job.progressPercent}%
                    </span>
                  </div>
                  <p className="text-[11px] mt-0.5 text-slate-500">{job.stepDescription}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
