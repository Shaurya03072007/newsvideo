import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Shield,
  Lock,
  Globe,
  AlertCircle,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import type { User } from '../shared/types.ts';
import { useToast } from './ToastNotification.tsx';

interface LoginGateViewProps {
  onLoginSuccess: (user: User) => void;
}

interface UnregisteredPromptData {
  email: string;
  name: string;
  picture?: string;
  sub?: string;
  hasEditor: boolean;
}

export const LoginGateView: React.FC<LoginGateViewProps> = ({ onLoginSuccess }) => {
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unregisteredData, setUnregisteredData] = useState<UnregisteredPromptData | null>(null);
  const [editorTeluguName, setEditorTeluguName] = useState('');

  // Initialize Google Identity Services
  useEffect(() => {
    const clientId =
      (typeof window !== 'undefined' && (window as any).__GOOGLE_CLIENT_ID__) ||
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;

    if (!clientId) {
      setErrorMessage('Google Client ID కాన్ఫిగర్ చేయబడలేదు. దయచేసి .env లో VITE_GOOGLE_CLIENT_ID ను తనిఖీ చేయండి.');
      return;
    }

    let intervalId: any = null;
    let attempts = 0;

    const renderGoogleButton = () => {
      attempts++;
      if ((window as any).google?.accounts?.id) {
        if (intervalId) clearInterval(intervalId);
        try {
          (window as any).google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: any) => {
              if (response.credential) {
                await handleGoogleCredentialLogin(response.credential);
              }
            },
          });
          const container = document.getElementById('login-gate-google-button');
          if (container) {
            container.innerHTML = '';
            (window as any).google.accounts.id.renderButton(container, {
              theme: 'filled_blue',
              size: 'large',
              shape: 'pill',
              text: 'continue_with',
              width: 320,
            });
          }
        } catch (err) {
          console.warn('Google Identity button initialization note:', err);
        }
      } else if (attempts > 50) {
        if (intervalId) clearInterval(intervalId);
      }
    };

    renderGoogleButton();
    if (!(window as any).google?.accounts?.id) {
      intervalId = setInterval(renderGoogleButton, 100);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const handleGoogleCredentialLogin = async (credential: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'లాగిన్ విఫలమైంది');

      if (data.registered && data.user) {
        addToast({
          type: 'success',
          title: 'లాగిన్ విజయవంతమైంది',
          message: `స్వాగతం, ${data.user.displayNameTelugu || data.user.displayName}!`,
        });
        onLoginSuccess(data.user);
      } else if (data.isUnregistered) {
        // User email is completely unregistered in the database
        setUnregisteredData({
          email: data.email,
          name: data.name,
          picture: data.picture,
          sub: data.sub,
          hasEditor: Boolean(data.hasEditor),
        });
        setEditorTeluguName(`${data.name} (ప్రధాన సంపాదకులు)`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'గూగుల్ ఖాతా ధృవీకరణలో సమస్య ఏర్పడింది.');
      addToast({
        type: 'error',
        title: 'Authentication Error',
        message: err.message || 'Could not verify Google account.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterAsEditor = async () => {
    if (!unregisteredData) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: unregisteredData.email,
          name: unregisteredData.name,
          picture: unregisteredData.picture,
          sub: unregisteredData.sub,
          displayNameTelugu: editorTeluguName.trim() || `${unregisteredData.name} (ప్రధాన సంపాదకులు)`,
          role: 'editor',
          district: 'విజయవాడ కేంద్ర కార్యాలయం',
          bureau: 'సెంట్రల్ ఎడిటోరియల్ డెస్క్',
          registerAsEditor: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'సంపాదకుల నమోదు విఫలమైంది');

      if (data.user) {
        addToast({
          type: 'success',
          title: 'ప్రధాన సంపాదకులుగా నమోదు పూర్తయింది',
          message: `స్వాగతం, ${data.user.displayNameTelugu || data.user.displayName}! న్యూస్‌రూమ్‌కు స్వాగతం.`,
        });
        onLoginSuccess(data.user);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'నమోదు ప్రక్రియలో సమస్య ఏర్పడింది.');
      addToast({
        type: 'error',
        title: 'Registration Error',
        message: err.message || 'Could not complete editor registration.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col justify-between text-slate-100 relative overflow-hidden select-none">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-rose-900/25 via-red-950/15 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 left-1/4 w-[500px] h-[300px] bg-amber-900/10 blur-3xl pointer-events-none" />

      {/* Top Bar */}
      <header className="border-b border-slate-900 bg-slate-950/70 backdrop-blur px-6 py-4 relative z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 via-red-600 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-950/60">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white font-telugu-sans">
                  ప్రజా వాణి
                </span>
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-mono font-semibold hidden sm:inline">
                  PRAJA VANI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                ఆంధ్రప్రదేశ్ &amp; తెలంగాణ సమగ్ర దినపత్రిక · డిజిటల్ న్యూస్‌రూమ్
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400">
            <Lock className="w-3.5 h-3.5 text-rose-400" />
            <span>సురక్షిత ప్రవేశం (Secure Access)</span>
          </div>
        </div>
      </header>

      {/* Main Login Area */}
      <main className="flex-1 flex items-center justify-center p-4 relative z-10 my-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl shadow-black/90 p-6 sm:p-8 backdrop-blur-xl"
        >
          {/* Masthead Banner inside Card */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 to-red-600 text-white shadow-xl shadow-rose-950/70 mb-3 border border-rose-500/40">
              <Shield className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight font-telugu-sans">
              ప్రజా వాణి న్యూస్‌రూమ్
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              దినపత్రిక ప్రచురణ మరియు వార్తా నిర్వహణ వ్యవస్థ
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-xs text-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Normal Login State: Only Google Button */}
          {!unregisteredData ? (
            <div className="space-y-4 text-center">
              <div className="p-6 bg-slate-950/60 border border-slate-800/80 rounded-2xl flex flex-col items-center justify-center">
                <p className="text-xs text-slate-300 font-medium mb-5">
                  న్యూస్‌రూమ్‌లోకి ప్రవేశించడానికి మీ అధికారిక Google ఖాతాతో లాగిన్ అవ్వండి:
                </p>

                {/* Google Identity Services Container - Exclusively the only login method */}
                <div id="login-gate-google-button" className="flex justify-center items-center min-h-[44px] w-full" />

                {isLoading && (
                  <div className="flex items-center justify-center gap-2 mt-4 text-xs text-rose-400 font-medium">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>ఖాతా ధృవీకరిస్తోంది, దయచేసి వేచి ఉండండి...</span>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-500">
                గమనిక: ప్రధాన సంపాదకులు మరియు నమోదు చేసుకున్న రిపోర్టర్లు మాత్రమే లాగిన్ కాగలరు.
              </p>
            </div>
          ) : (
            /* Unregistered User Workflow Card */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-amber-200">
                <div className="flex items-center gap-2 mb-2 font-bold text-sm text-amber-300">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>ఖాతా నమోదు పరిశీలన (Account Not Found)</span>
                </div>
                <p className="text-xs text-amber-100/90 leading-relaxed">
                  మీ Google ఖాతా <strong className="text-white underline">{unregisteredData.email}</strong> ఇంకా రిపోర్టర్‌గా నమోదు కాలేదు.
                </p>
              </div>

              {/* Ask to register as Main Editor */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wide">
                  <UserCheck className="w-4 h-4" />
                  <span>ప్రధాన సంపాదకుల నమోదు (Register as Main Editor)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  మీ Google ఖాతా (<strong>{unregisteredData.email}</strong>)తో ప్రజా వాణి దినపత్రిక <strong>ప్రధాన సంపాదకులు (Main Editor)</strong>గా నమోదు కావాలనుకుంటున్నారా?
                </p>

                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleRegisterAsEditor}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5" />
                    )}
                    <span>అవును, ప్రధాన సంపాదకులుగా నమోదు అవ్వండి</span>
                  </button>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => setUnregisteredData(null)}
                    className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 transition cursor-pointer"
                  >
                    రద్దు చేయండి (Cancel)
                  </button>
                </div>
              </div>

              {unregisteredData.hasEditor && (
                <p className="text-[11px] text-slate-500 text-center">
                  మీరు రిపోర్టర్ అయితే, దయచేసి ప్రధాన సంపాదకులను సంప్రదించండి, వారు మీ Gmailని అనుమతి జాబితాలో చేరుస్తారు.
                </p>
              )}
            </div>
          )}

          {/* Security footnote */}
          <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Google OAuth 2.0 ధృవీకృతం
            </span>
            <span>సురక్షిత న్యూస్‌రూమ్</span>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-4 text-center text-xs text-slate-500 relative z-10">
        <p>
          ప్రజా వాణి (Praja Vani) తెలుగు దినపత్రిక ప్రచురణ వ్యవస్థ · యూనికోడ్ అక్షర విన్యాసం
        </p>
      </footer>
    </div>
  );
};
