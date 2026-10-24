import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  Mail,
  MapPin,
  Building2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Shield,
} from 'lucide-react';
import type { User } from '../shared/types.ts';
import { useToast } from './ToastNotification.tsx';

interface ReportersManagementViewProps {
  currentUser: User;
  theme?: 'light' | 'dark';
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

export const ReportersManagementView: React.FC<ReportersManagementViewProps> = ({
  currentUser,
  theme = 'dark',
}) => {
  const { addToast } = useToast();
  const [reporters, setReporters] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [displayNameTelugu, setDisplayNameTelugu] = useState('');
  const [district, setDistrict] = useState(TELUGU_DISTRICTS[0]);
  const [bureau, setBureau] = useState(TELUGU_BUREAUS[0]);
  const [reporterToDelete, setReporterToDelete] = useState<User | null>(null);

  const fetchReporters = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/users/reporters');
      if (res.ok) {
        const data = await res.json();
        setReporters(data.reporters || []);
      }
    } catch (err) {
      console.error('Failed to load reporters:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReporters();
  }, []);

  const handleAddReporter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      addToast({
        type: 'error',
        title: 'వివరాలు అసంపూర్ణం',
        message: 'దయచేసి రిపోర్టర్ పేరు మరియు Gmail ఈమెయిల్ నమోదు చేయండి.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/users/reporters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          displayNameTelugu: displayNameTelugu.trim() || `${name.trim()} (జర్నలిస్ట్)`,
          district,
          bureau,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'రిపోర్టర్‌ను చేర్చడం విఫలమైంది');

      addToast({
        type: 'success',
        title: 'రిపోర్టర్ చేర్చబడ్డారు! ✨',
        message: `${name} (${email}) విజయవంతంగా నమోదు చేయబడ్డారు. వారు ఇప్పుడు Google లాగిన్ ద్వారా ప్రవేశించవచ్చు.`,
      });

      // Reset form
      setName('');
      setEmail('');
      setDisplayNameTelugu('');
      fetchReporters();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'నమోదు విఫలమైంది',
        message: err.message || 'రిపోర్టర్‌ను చేర్చడంలో లోపం ఏర్పడింది.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!reporterToDelete) return;
    try {
      const res = await fetch(`/api/users/reporters/${reporterToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentUser.id,
        },
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // ignore parse error if response was empty or non-JSON
      }

      if (res.ok) {
        addToast({
          type: 'success',
          title: 'రిపోర్టర్ తొలగించబడ్డారు',
          message: `${reporterToDelete.displayName} న్యూస్‌రూమ్ నుండి తొలగించబడ్డారు.`,
        });
        setReporterToDelete(null);
        fetchReporters();
      } else {
        throw new Error(data?.error || `తొలగించడం విఫలమైంది (${res.status})`);
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'తొలగింపు లోపం',
        message: err.message || 'రిపోర్టర్‌ను తొలగించలేకపోయాము.',
      });
    }
  };

  const filteredReporters = reporters.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.displayName.toLowerCase().includes(q) ||
      (r.displayNameTelugu && r.displayNameTelugu.toLowerCase().includes(q)) ||
      (r.email && r.email.toLowerCase().includes(q)) ||
      r.district.toLowerCase().includes(q) ||
      r.bureau.toLowerCase().includes(q)
    );
  });

  const isLight = theme === 'light';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div
        className={`p-6 rounded-2xl border transition-colors ${
          isLight
            ? 'bg-white border-stone-300 shadow-sm'
            : 'bg-slate-900/90 border-slate-800 shadow-xl shadow-black/40'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center text-white shadow-lg">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2
                className={`text-lg font-bold font-telugu-sans ${
                  isLight ? 'text-stone-900' : 'text-white'
                }`}
              >
                జర్నలిస్టుల &amp; రిపోర్టర్ల నిర్వహణ (Reporters Management)
              </h2>
              <p className={`text-xs ${isLight ? 'text-stone-600' : 'text-slate-400'}`}>
                వార్తా విభాగం ఫీల్డ్ రిపోర్టర్ల Gmail ఖాతాలను చేర్చండి. రిపోర్టర్ లాగిన్ అయినప్పుడు వారికి కేవలం వార్తల నమోదు డెస్క్ మాత్రమే అందుబాటులో ఉంటుంది.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold ${
                isLight
                  ? 'bg-stone-100 border-stone-300 text-stone-700'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              మొత్తం రిపోర్టర్లు: <span className="text-rose-500 font-extrabold">{reporters.length}</span>
            </div>
            <button
              type="button"
              onClick={fetchReporters}
              className={`p-2 rounded-xl border cursor-pointer transition-colors ${
                isLight
                  ? 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-700'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
              title="జాబితాను రీఫ్రెష్ చేయండి"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Cols: Add Reporter Form */}
        <div
          className={`lg:col-span-5 p-6 rounded-2xl border transition-colors ${
            isLight
              ? 'bg-white border-stone-300 shadow-sm'
              : 'bg-slate-900/90 border-slate-800 shadow-xl shadow-black/40'
          }`}
        >
          <div className="border-b pb-3 mb-4 border-slate-800/40">
            <h3
              className={`text-sm font-bold font-telugu-sans flex items-center gap-2 ${
                isLight ? 'text-stone-900' : 'text-white'
              }`}
            >
              <UserPlus className="w-4 h-4 text-rose-500" />
              కొత్త రిపోర్టర్‌ను చేర్చండి (Add New Reporter)
            </h3>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-stone-500' : 'text-slate-400'}`}>
              రిపోర్టర్ Gmail నమోదు చేయండి. వారు తమ Google ఖాతాతో సులభంగా ప్రవేశించవచ్చు.
            </p>
          </div>

          <form onSubmit={handleAddReporter} className="space-y-3.5">
            <div>
              <label
                className={`block text-xs font-semibold mb-1 ${
                  isLight ? 'text-stone-700' : 'text-slate-300'
                }`}
              >
                పూర్తి పేరు (Full Name) *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ఉదా: కిరణ్ కుమార్"
                className={`w-full px-3 py-2 rounded-xl text-xs font-medium border focus:outline-none focus:border-rose-500 transition ${
                  isLight
                    ? 'bg-stone-50 border-stone-300 text-stone-900'
                    : 'bg-slate-950 border-slate-700 text-white'
                }`}
              />
            </div>

            <div>
              <label
                className={`block text-xs font-semibold mb-1 ${
                  isLight ? 'text-stone-700' : 'text-slate-300'
                }`}
              >
                Gmail ఈమెయిల్ (Reporter's Gmail) *
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="reporter.name@gmail.com"
                  className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs font-medium border focus:outline-none focus:border-rose-500 transition ${
                    isLight
                      ? 'bg-stone-50 border-stone-300 text-stone-900'
                      : 'bg-slate-950 border-slate-700 text-white'
                  }`}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                రిపోర్టర్ ఈ Gmailతోనే వెబ్‌సైట్‌లో 'Sign In with Google' ద్వారా ప్రవేశించాలి.
              </p>
            </div>

            <div>
              <label
                className={`block text-xs font-semibold mb-1 ${
                  isLight ? 'text-stone-700' : 'text-slate-300'
                }`}
              >
                తెలుగులో బైలైన్ పేరు (Telugu Byline)
              </label>
              <input
                type="text"
                value={displayNameTelugu}
                onChange={(e) => setDisplayNameTelugu(e.target.value)}
                placeholder="ఉదా: కిరణ్ కుమార్ (విజయవాడ ప్రతినిధి)"
                className={`w-full px-3 py-2 rounded-xl text-xs font-medium border focus:outline-none focus:border-rose-500 transition ${
                  isLight
                    ? 'bg-stone-50 border-stone-300 text-stone-900'
                    : 'bg-slate-950 border-slate-700 text-white'
                }`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  className={`block text-xs font-semibold mb-1 ${
                    isLight ? 'text-stone-700' : 'text-slate-300'
                  }`}
                >
                  జిల్లా (District)
                </label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className={`w-full px-2.5 py-2 rounded-xl text-xs font-medium border focus:outline-none focus:border-rose-500 transition ${
                    isLight
                      ? 'bg-stone-50 border-stone-300 text-stone-900'
                      : 'bg-slate-950 border-slate-700 text-white'
                  }`}
                >
                  {TELUGU_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className={`block text-xs font-semibold mb-1 ${
                    isLight ? 'text-stone-700' : 'text-slate-300'
                  }`}
                >
                  బ్యూరో డెస్క్ (Bureau Desk)
                </label>
                <select
                  value={bureau}
                  onChange={(e) => setBureau(e.target.value)}
                  className={`w-full px-2.5 py-2 rounded-xl text-xs font-medium border focus:outline-none focus:border-rose-500 transition ${
                    isLight
                      ? 'bg-stone-50 border-stone-300 text-stone-900'
                      : 'bg-slate-950 border-slate-700 text-white'
                  }`}
                >
                  {TELUGU_BUREAUS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
              <span>రిపోర్టర్‌ను నమోదు చేయండి (Add Reporter)</span>
            </button>
          </form>
        </div>

        {/* Right 7 Cols: Reporters List */}
        <div
          className={`lg:col-span-7 p-6 rounded-2xl border transition-colors ${
            isLight
              ? 'bg-white border-stone-300 shadow-sm'
              : 'bg-slate-900/90 border-slate-800 shadow-xl shadow-black/40'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 mb-4 border-slate-800/40">
            <div>
              <h3
                className={`text-sm font-bold font-telugu-sans ${
                  isLight ? 'text-stone-900' : 'text-white'
                }`}
              >
                నమోదైన రిపోర్టర్ల జాబితా ({reporters.length})
              </h3>
              <p className={`text-xs mt-0.5 ${isLight ? 'text-stone-500' : 'text-slate-400'}`}>
                ఈ రిపోర్టర్లు వార్తల నమోదు డెస్క్‌కు మాత్రమే ప్రవేశం కలిగి ఉంటారు.
              </p>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="రిపోర్టర్ పేరు లేదా ఈమెయిల్..."
                className={`pl-8 pr-3 py-1.5 rounded-xl text-xs border focus:outline-none focus:border-rose-500 ${
                  isLight
                    ? 'bg-stone-50 border-stone-300 text-stone-900'
                    : 'bg-slate-950 border-slate-700 text-white'
                }`}
              />
            </div>
          </div>

          {filteredReporters.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
              <p className={`text-xs ${isLight ? 'text-stone-500' : 'text-slate-400'}`}>
                {searchQuery
                  ? 'శోధనకు తగిన రిపోర్టర్లు ఎవరూ లేరు.'
                  : 'ఇంకా ఎవరూ రిపోర్టర్లు చేర్చబడలేదు. ఎడమవైపు ఫారమ్ ద్వారా రిపోర్టర్‌ను చేర్చండి.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr
                    className={`border-b ${
                      isLight ? 'border-stone-200 text-stone-500' : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    <th className="py-2.5 px-3 font-semibold">రిపోర్టర్</th>
                    <th className="py-2.5 px-3 font-semibold">Gmail ఈమెయిల్</th>
                    <th className="py-2.5 px-3 font-semibold">జిల్లా / బ్యూరో</th>
                    <th className="py-2.5 px-3 font-semibold text-right">చర్యలు</th>
                  </tr>
                </thead>
                <tbody
                  className={`divide-y ${
                    isLight ? 'divide-stone-200' : 'divide-slate-800'
                  }`}
                >
                  {filteredReporters.map((rep) => (
                    <tr
                      key={rep.id}
                      className={`transition-colors ${
                        isLight ? 'hover:bg-stone-50' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={
                              rep.avatarUrl ||
                              `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                                rep.email || rep.id
                              )}`
                            }
                            alt={rep.displayName}
                            className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 shrink-0"
                          />
                          <div>
                            <div
                              className={`font-bold font-telugu-sans ${
                                isLight ? 'text-stone-900' : 'text-white'
                              }`}
                            >
                              {rep.displayNameTelugu || rep.displayName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {rep.displayName}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div
                          className={`font-mono text-xs ${
                            isLight ? 'text-stone-700' : 'text-slate-300'
                          }`}
                        >
                          {rep.email || '—'}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div
                          className={`text-xs ${
                            isLight ? 'text-stone-800' : 'text-slate-200'
                          }`}
                        >
                          {rep.district}
                        </div>
                        <div className="text-[10px] text-slate-400">{rep.bureau}</div>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setReporterToDelete(rep)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-rose-500 hover:text-white hover:bg-rose-600 rounded-lg border border-rose-500/30 transition-colors flex items-center gap-1 ml-auto cursor-pointer"
                          title="ఈ రిపోర్టర్‌ను తొలగించండి"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>తొలగించండి</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {reporterToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`max-w-md w-full p-6 rounded-2xl border shadow-2xl ${
              isLight
                ? 'bg-white border-stone-300 text-stone-900'
                : 'bg-slate-900 border-slate-800 text-white'
            }`}
          >
            <div className="flex items-center gap-3 text-rose-500 mb-3">
              <AlertCircle className="w-6 h-6" />
              <h4 className="text-base font-bold font-telugu-sans">
                రిపోర్టర్‌ను తొలగించాలా?
              </h4>
            </div>

            <p className={`text-xs mb-4 leading-relaxed ${isLight ? 'text-stone-600' : 'text-slate-300'}`}>
              మీరు <strong>{reporterToDelete.displayNameTelugu || reporterToDelete.displayName}</strong> ({reporterToDelete.email}) ని రిపోర్టర్ల జాబితా నుండి తొలగించబోతున్నారు. వారు ఇకపై న్యూస్‌రూమ్‌లోకి ప్రవేశించలేరు.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReporterToDelete(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                  isLight
                    ? 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-700'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                }`}
              >
                రద్దు చేయండి
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
              >
                అవును, తొలగించండి
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
