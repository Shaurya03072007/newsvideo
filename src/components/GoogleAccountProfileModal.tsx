import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User as UserIcon,
  Check,
  X,
  LogOut,
  Sparkles,
  Building2,
  MapPin,
  Mail,
  Camera,
  Save,
  Globe,
  Radio,
  RefreshCw,
} from 'lucide-react';
import type { User, UserRole, UserProfileUpdate } from '../shared/types.ts';
import { useToast } from './ToastNotification.tsx';

interface GoogleAccountProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  users: User[];
  onUserChange: (user: User) => void;
  onLogout: () => void;
}

const TELUGU_DISTRICTS = [
  'ఎన్టీఆర్ జిల్లా (విజయవాడ)',
  'కృష్ణా జిల్లా',
  'గుంటూరు',
  'విశాఖపట్నం',
  'వరంగల్',
  'హైదరాబాద్',
  'తిరుపతి',
  'కడప (వైఎస్సార్)',
  'కర్నూలు',
  'నెల్లూరు',
  'తూర్పు గోదావరి',
  'పశ్చిమ గోదావరి',
  'అనంతపురం',
  'కరీంనగర్',
  'ఖమ్మం',
];

const TELUGU_BUREAUS = [
  'విజయవాడ ప్రధాన కార్యాలయం (Central Bureau)',
  'సెంట్రల్ ఎడిటోరియల్ డెస్క్ (News Desk)',
  'ఉత్తరాంధ్ర బ్యూరో (Vizag Desk)',
  'గుంటూరు ప్రాంతీయ డెస్క్ (Guntur Bureau)',
  'తెలంగాణ ప్రాంతీయ డెస్క్ (Telangana Desk)',
  'డిజిటల్ మీడియా & ఈ-పేపర్ విభాగం (Digital e-Paper)',
];

export const GoogleAccountProfileModal: React.FC<GoogleAccountProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  users,
  onUserChange,
  onLogout,
}) => {
  const { addToast } = useToast();
  // Profile Form States
  const [displayName, setDisplayName] = useState('');
  const [displayNameTelugu, setDisplayNameTelugu] = useState('');
  const [role, setRole] = useState<UserRole>('reporter');
  const [district, setDistrict] = useState('');
  const [bureau, setBureau] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state whenever currentUser changes or modal opens
  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || '');
      setDisplayNameTelugu(currentUser.displayNameTelugu || '');
      setRole(currentUser.role || 'reporter');
      setDistrict(currentUser.district || TELUGU_DISTRICTS[0]);
      setBureau(currentUser.bureau || TELUGU_BUREAUS[0]);
      setEmail(currentUser.email || '');
      setAvatarUrl(currentUser.avatarUrl || '');
    }
  }, [currentUser, isOpen]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setIsSaving(true);
    try {
      const payload: UserProfileUpdate = {
        displayName: displayName.trim(),
        displayNameTelugu: displayNameTelugu.trim(),
        role,
        district: district.trim(),
        bureau: bureau.trim(),
        email: email.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      };

      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      if (data.user) {
        onUserChange(data.user);
        addToast({
          type: 'success',
          title: 'Profile Updated',
          message: 'జర్నలిస్ట్ ప్రొఫైల్ వివరాలు విజయవంతంగా భద్రపరచబడ్డాయి.',
        });
        onClose();
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'Unable to update profile.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'x-user-id': currentUser?.id || '',
        },
        credentials: 'include',
      });
    } catch {
      // ignore
    }
    onLogout();
    addToast({
      type: 'info',
      title: 'Signed Out',
      message: 'Logged out of newsroom session.',
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden text-slate-100 flex flex-col my-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 via-rose-600 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-rose-900/40">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>ప్రజా వాణి న్యూస్‌రూమ్ ప్రొఫైల్</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Google OAuth &amp; Profile
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Google Account &amp; Telugu Newsroom Bureau Profile
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current User Snapshot Banner */}
          {currentUser && (
            <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.displayName}
                      className="w-10 h-10 rounded-full object-cover border-2 border-rose-500/50 shadow"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow">
                      {currentUser.displayName.charAt(0)}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-100">
                      {currentUser.displayNameTelugu || currentUser.displayName}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                        currentUser.role === 'admin'
                          ? 'bg-purple-900/60 text-purple-300 border border-purple-500/40'
                          : currentUser.role === 'editor'
                          ? 'bg-amber-900/60 text-amber-300 border border-amber-500/40'
                          : 'bg-blue-900/60 text-blue-300 border border-blue-500/40'
                      }`}
                    >
                      {currentUser.role}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>{currentUser.bureau}</span>
                    {currentUser.email && (
                      <>
                        <span>•</span>
                        <span>{currentUser.email}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/50 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                title="Sign out of current account"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          )}

          {/* Modal Title Bar */}
          <div className="flex border-b border-slate-800 bg-slate-900/90 px-6 py-2.5 items-center gap-2 text-rose-400 font-semibold text-xs">
            <UserIcon className="w-3.5 h-3.5" />
            <span>జర్నలిస్ట్ ప్రొఫైల్ వివరాలు (Edit Profile)</span>
          </div>

          {/* Modal Body Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh] space-y-5">
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      తెలుగులో పూర్తి పేరు (Telugu Display Name) *
                    </label>
                    <input
                      type="text"
                      required
                      value={displayNameTelugu}
                      onChange={(e) => setDisplayNameTelugu(e.target.value)}
                      placeholder="ఉదా: కె. వెంకటరావు (విజయవాడ)"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      ఇంగ్లీష్ పేరు (English Name) *
                    </label>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. K. Venkat Rao"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      హోదా (Newsroom Role)
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500 transition"
                    >
                      <option value="reporter">ఫీల్డ్ రిపోర్టర్ (Reporter)</option>
                      <option value="editor">సబ్-ఎడిటర్ / ప్రధాన సంపాదకులు (Editor)</option>
                      <option value="admin">న్యూస్‌రూమ్ అడ్మినిస్ట్రేటర్ (Admin)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      జిల్లా (District)
                    </label>
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500 transition"
                    >
                      {TELUGU_DISTRICTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    బ్యూరో కార్యాలయం (Assigned Bureau Desk)
                  </label>
                  <select
                    value={bureau}
                    onChange={(e) => setBureau(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500 transition"
                  >
                    {TELUGU_BUREAUS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      ఈమెయిల్ (Google Account Email)
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="yourname@gmail.com"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      ప్రొఫైల్ ఫోటో లింక్ (Avatar URL)
                    </label>
                    <div className="relative">
                      <Camera className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                      <input
                        type="url"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    రద్దు (Cancel)
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 text-xs font-bold bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-lg shadow-lg shadow-rose-950/50 flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
                  >
                    {isSaving ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>భద్రపరచు (Save Profile)</span>
                  </button>
                </div>
              </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
