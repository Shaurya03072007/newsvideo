import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, Zap, Radio, ChevronRight, Play, Square } from 'lucide-react';
import type { Article } from '../shared/types.ts';

// Subtle Web Audio synthesizer for lively, non-intrusive sound feedback
class NewsroomAudioEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = false;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playBlip(freq = 640, duration = 0.06) {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // ignore audio error
    }
  }

  playSuccess() {
    if (!this.enabled) return;
    this.playBlip(520, 0.08);
    setTimeout(() => this.playBlip(784, 0.12), 80);
  }

  playBreaking() {
    if (!this.enabled) return;
    this.playBlip(880, 0.08);
    setTimeout(() => this.playBlip(660, 0.08), 90);
    setTimeout(() => this.playBlip(990, 0.14), 180);
  }
}

export const newsroomAudio = new NewsroomAudioEngine();

export function speakTelugu(text: string, onEnd?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'te-IN';
  utterance.rate = 0.92;
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

interface BreakingNewsTickerProps {
  articles: Article[];
  onSelectArticle: (articleId: string) => void;
  onSimulateBreaking?: () => void;
  isSimulating?: boolean;
}

export const BreakingNewsTicker: React.FC<BreakingNewsTickerProps> = ({
  articles,
  onSelectArticle,
  onSimulateBreaking,
  isSimulating = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Filter top dispatches
  const topArticles = articles
    .filter((a) => a.primaryHeadlineTelugu || a.originalHeadline)
    .sort((a, b) => b.priorityScore - a.priorityScore);

  useEffect(() => {
    if (topArticles.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % topArticles.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [topArticles.length]);

  const active = topArticles[currentIndex] || topArticles[0];

  const handleToggleSound = () => {
    const nextState = !soundOn;
    setSoundOn(nextState);
    newsroomAudio.enabled = nextState;
    if (nextState) {
      newsroomAudio.playBlip(880, 0.09);
    }
  };

  const handleReadAloud = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!active) return;
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      const headline = active.primaryHeadlineTelugu || active.originalHeadline;
      const body = active.summaryTelugu || active.originalBodyTelugu;
      speakTelugu(`${headline}. ${body}`, () => setIsSpeaking(false));
    }
  };

  if (!active) return null;

  return (
    <div className="bg-[#070B12] border-b border-slate-800/70 px-4 sm:px-6 py-1.5 backdrop-blur-md flex items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Pulsing Live Badge */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 font-bold uppercase tracking-wider text-[10px] shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
          <Radio className="w-3 h-3 text-rose-400" />
          <span className="hidden xs:inline">తాజా వార్తలు · LIVE</span>
          <span className="xs:hidden">LIVE</span>
        </div>

        {/* Current Rotating Breaking Story */}
        <div
          onClick={() => onSelectArticle(active.id)}
          className="cursor-pointer group flex items-center gap-2 min-w-0 hover:text-amber-300 transition-colors"
          title="ఈ తాజా వార్తను పరిశీలించడానికి క్లిక్ చేయండి"
        >
          <span className="font-telugu-sans font-bold text-amber-400 text-xs shrink-0">
            [{active.location}]
          </span>
          <span className="font-telugu-sans font-medium text-slate-200 text-xs truncate group-hover:underline">
            {active.primaryHeadlineTelugu || active.originalHeadline}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>

      {/* Interactive Controls: Audio & Wire Sim */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleReadAloud}
          className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1 cursor-pointer transition-colors ${
            isSpeaking
              ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
              : 'bg-slate-900/80 text-slate-300 border-slate-700/80 hover:bg-slate-800'
          }`}
          title="Listen to this story in Telugu (Browser Text-to-Speech)"
        >
          {isSpeaking ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3 text-amber-400" />}
          <span className="hidden sm:inline">{isSpeaking ? 'ఆపండి' : 'వినండి'}</span>
        </button>

        <button
          type="button"
          onClick={handleToggleSound}
          className={`p-1 rounded border text-xs cursor-pointer transition-colors ${
            soundOn
              ? 'bg-amber-400/20 text-amber-300 border-amber-500/50'
              : 'bg-slate-900/80 text-slate-400 border-slate-700/80 hover:text-slate-200'
          }`}
          title={soundOn ? 'Newsroom Audio Enabled' : 'Enable Newsroom Audio'}
        >
          {soundOn ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
        </button>

        {onSimulateBreaking && (
          <button
            type="button"
            disabled={isSimulating}
            onClick={() => {
              newsroomAudio.playBreaking();
              onSimulateBreaking();
            }}
            className="px-2 py-0.5 text-[11px] font-medium rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
            title="Inject an authentic breaking field dispatch"
          >
            <Zap className={`w-3 h-3 text-amber-400 ${isSimulating ? 'animate-bounce' : ''}`} />
            <span className="hidden md:inline">Sim Wire</span>
          </button>
        )}
      </div>
    </div>
  );
};
