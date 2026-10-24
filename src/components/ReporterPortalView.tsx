import React, { useState } from 'react';
import {
  Camera,
  CheckCircle2,
  FileText,
  Send,
  Upload,
  UserCheck,
  AlertCircle,
  Sparkles,
  Save,
  Zap,
  Info,
  Trash2,
} from 'lucide-react';
import type {
  Article,
  CategoryConfig,
  NewspaperCategory,
  User,
} from '../shared/types.ts';
import { countTeluguSyllables, containsTeluguUnicode } from '../utils/editorialLogic.ts';
import { useToast } from './ToastNotification.tsx';

interface ReporterPortalViewProps {
  theme?: 'light' | 'dark';
  currentUser: User;
  users: User[];
  categories: CategoryConfig[];
  articles: Article[];
  onSwitchUser: (userId: string) => Promise<void>;
  onArticleCreated: (article: Article, jobId?: string) => void;
  onInspectArticle: (articleId: string) => void;
  onDeleteArticle?: (articleId: string) => Promise<void> | void;
}

export const ReporterPortalView: React.FC<ReporterPortalViewProps> = React.memo(({
  theme = 'light',
  currentUser,
  users,
  categories,
  articles,
  onSwitchUser,
  onArticleCreated,
  onInspectArticle,
  onDeleteArticle,
}) => {
  const { addToast } = useToast();
  const [originalHeadline, setOriginalHeadline] = useState('');
  const [originalBodyTelugu, setOriginalBodyTelugu] = useState('');
  const [location, setLocation] = useState(currentUser.district.split(' ')[0] || 'విజయవాడ');
  const [district, setDistrict] = useState(currentUser.district || 'ఎన్టీఆర్ జిల్లా');
  const [eventDate, setEventDate] = useState('2026-10-19');
  const [suggestedCategory, setSuggestedCategory] = useState<NewspaperCategory>('Local news');
  const [photoCaptionTelugu, setPhotoCaptionTelugu] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [samplePhotoTheme, setSamplePhotoTheme] = useState<'dam_water' | 'paddy_harvest' | 'smart_school' | 'metro_infra' | ''>('dam_water');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const syllableCount = countTeluguSyllables(originalBodyTelugu);

  const myArticles = articles.filter((a) => {
    if (currentUser.role === 'editor') return true;
    return (
      a.reporterId === currentUser.id ||
      (Boolean(a.reporterName) && a.reporterName?.toLowerCase() === currentUser.displayName.toLowerCase()) ||
      (Boolean(currentUser.email && a.reporterName) && a.reporterName?.toLowerCase() === currentUser.email?.toLowerCase())
    );
  });

  const handleSubmit = async (saveAsDraft: boolean) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      if (!originalBodyTelugu.trim()) {
        throw new Error('దయచేసి వార్తా పాఠ్యాన్ని నమోదు చేయండి (తెలుగు లేదా ఆంగ్లంలో).');
      }
      if (originalBodyTelugu.trim().length < 20) {
        throw new Error('కనీసం 20 అక్షరాల వార్తా పాఠ్యాన్ని నమోదు చేయండి (Please enter at least 20 characters).');
      }

      addToast({
        type: 'loading',
        title: saveAsDraft ? 'వార్త చిత్తుప్రతి సేవ్ అవుతోంది...' : 'వార్త సమర్పించబడుతోంది...',
        message: `${location} బ్యూరో నుండి పంపుతోంది...`,
      });

      const submissionIdemKey = `idem-${currentUser.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const createRes = await fetch('/api/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({
          originalHeadline,
          originalBodyTelugu,
          location,
          district,
          eventDate,
          suggestedCategory,
          saveAsDraft,
          autoProcess: false,
          idempotencyKey: submissionIdemKey,
        }),
      });

      let createData: any = null;
      try {
        createData = await createRes.json();
      } catch {
        // ignore parse error if response was empty or non-JSON
      }

      if (!createRes.ok || !createData?.article) {
        throw new Error(createData?.error || `వార్త సమర్పణ విఫలమైంది (${createRes.status}).`);
      }

      const createdArticle: Article = createData.article;

      // Upload photograph if selectedFile or samplePhotoTheme is chosen
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('captionTelugu', photoCaptionTelugu || `${location}: వార్తా చిత్రం`);
        formData.append('isPrimary', 'true');
        const assetRes = await fetch(`/api/articles/${createdArticle.id}/assets`, {
          method: 'POST',
          headers: { 'x-user-id': currentUser.id },
          body: formData,
        });
        let assetData: any = null;
        try {
          assetData = await assetRes.json();
        } catch {}
        if (!assetRes.ok) {
          throw new Error(assetData?.error || `చిత్రం అప్‌లోడ్ విఫలమైంది (${assetRes.status}).`);
        }
      } else if (samplePhotoTheme) {
        const assetRes = await fetch(`/api/articles/${createdArticle.id}/assets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': currentUser.id,
          },
          body: JSON.stringify({
            sampleTheme: samplePhotoTheme,
            captionTelugu: photoCaptionTelugu || `${location}: వార్తా చిత్రం`,
            isPrimary: true,
          }),
        });
        let assetData: any = null;
        try {
          assetData = await assetRes.json();
        } catch {}
        if (!assetRes.ok) {
          throw new Error(assetData?.error || `చిత్రం అనుసంధానం విఫలమైంది (${assetRes.status}).`);
        }
      }

      let jobId: string | undefined;
      if (!saveAsDraft) {
        const procRes = await fetch(`/api/articles/${createdArticle.id}/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': currentUser.id,
          },
          body: JSON.stringify({}),
        });
        let procData: any = null;
        try {
          procData = await procRes.json();
        } catch {}
        if (procRes.ok && procData?.jobId) {
          jobId = procData.jobId;
        }
      }

      const refreshedRes = await fetch(`/api/articles/${createdArticle.id}`);
      let refreshedData: any = null;
      try {
        refreshedData = await refreshedRes.json();
      } catch {}

      const successText = saveAsDraft
        ? `చిత్తుప్రతి సేవ్ చేయబడింది. మీరు ఎప్పుడైనా సవరించి సమర్పించవచ్చు.`
        : `వార్త విజయవంతంగా పంపబడింది. సంపాదక సమీక్షకు చేరింది.`;

      setSuccessMsg(successText);
      addToast({
        type: 'success',
        title: saveAsDraft ? 'చిత్తుప్రతి భద్రపరచబడింది' : 'వార్త విజయవంతంగా సమర్పించబడింది',
        message: successText,
      });

      setOriginalHeadline('');
      setOriginalBodyTelugu('');
      setSelectedFile(null);
      setSamplePhotoTheme('');
      setPhotoCaptionTelugu('');
      onArticleCreated(refreshedData.article || createdArticle, jobId);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setErrorMsg(errMsg);
      addToast({
        type: 'error',
        title: 'సమర్పణలో లోపం ఏర్పడింది',
        message: errMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLight = theme === 'light';

  return (
    <div className="max-w-4xl mx-auto w-full px-2 sm:px-0">
      <div
        className={`rounded-3xl p-6 sm:p-8 shadow-xl transition-colors duration-200 border space-y-6 ${
          isLight
            ? 'bg-white border-stone-200 shadow-stone-200/50 text-stone-900'
            : 'bg-slate-900/90 border-slate-800 shadow-black/50 text-slate-100'
        }`}
      >
        {/* Header */}
        <div
          className={`flex flex-wrap items-center justify-between gap-4 border-b pb-5 ${
            isLight ? 'border-stone-200' : 'border-slate-800'
          }`}
        >
          <div>
            <h2 className="text-xl font-bold font-telugu-sans flex items-center gap-2">
              <FileText className="w-5 h-5 text-rose-600" />
              <span>విలేకరి వార్తా సమర్పణ డెస్క్</span>
            </h2>
            <p className={`text-xs mt-1 ${isLight ? 'text-stone-500' : 'text-slate-400'}`}>
              పత్రిక ప్రచురణ కొరకు మీ నియోజకవర్గం/ప్రాంతపు వార్తా వివరాలు నమోదు చేయండి
            </p>
          </div>

          {/* Current Reporter Identity Badge */}
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs ${
              isLight
                ? 'bg-stone-100 border-stone-200 text-stone-700'
                : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold">{currentUser.displayNameTelugu || currentUser.displayName}</span>
            <span className="text-xs opacity-75">({currentUser.district})</span>
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="p-3 bg-rose-950/60 border border-rose-500/40 text-rose-200 rounded-xl text-xs flex items-start gap-2 shadow"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="p-3 bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 rounded-xl text-xs flex items-start gap-2 shadow"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Headline */}
          <div>
            <label
              htmlFor="input-headline"
              className={`block text-xs font-semibold mb-1.5 ${
                isLight ? 'text-stone-700' : 'text-slate-300'
              }`}
            >
              వార్త శీర్షిక (ఐచ్ఛికం - తెలుగు లేదా ఆంగ్లం)
            </label>
            <input
              id="input-headline"
              type="text"
              value={originalHeadline}
              onChange={(e) => setOriginalHeadline(e.target.value)}
              placeholder="ఉదా: జిల్లాలో నేటి నుంచే ధాన్యం కొనుగోలు కేంద్రాలు ప్రారంభం / Paddy procurement centers open..."
              className={`w-full px-3.5 py-2.5 text-sm font-telugu-sans rounded-xl border focus:outline-none transition-all ${
                isLight
                  ? 'bg-stone-50 border-stone-300 text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-rose-600'
                  : 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus:border-rose-500'
              }`}
            />
          </div>

          {/* Location, District, Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="input-location"
                className={`block text-xs font-semibold mb-1.5 ${
                  isLight ? 'text-stone-700' : 'text-slate-300'
                }`}
              >
                స్థలం / ఊరు *
              </label>
              <input
                id="input-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="విజయవాడ"
                className={`w-full px-3 py-2 text-sm font-telugu-sans rounded-xl border focus:outline-none transition-all ${
                  isLight
                    ? 'bg-stone-50 border-stone-300 text-stone-900 focus:bg-white focus:border-rose-600'
                    : 'bg-slate-950 border-slate-800 text-white focus:border-rose-500'
                }`}
              />
            </div>

            <div>
              <label
                htmlFor="input-district"
                className={`block text-xs font-semibold mb-1.5 ${
                  isLight ? 'text-stone-700' : 'text-slate-300'
                }`}
              >
                జిల్లా *
              </label>
              <input
                id="input-district"
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="ఎన్టీఆర్ జిల్లా"
                className={`w-full px-3 py-2 text-sm font-telugu-sans rounded-xl border focus:outline-none transition-all ${
                  isLight
                    ? 'bg-stone-50 border-stone-300 text-stone-900 focus:bg-white focus:border-rose-600'
                    : 'bg-slate-950 border-slate-800 text-white focus:border-rose-500'
                }`}
              />
            </div>

            <div>
              <label
                htmlFor="input-event-date"
                className={`block text-xs font-semibold mb-1.5 ${
                  isLight ? 'text-stone-700' : 'text-slate-300'
                }`}
              >
                తేదీ *
              </label>
              <input
                id="input-event-date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className={`w-full px-3 py-2 text-xs font-mono rounded-xl border focus:outline-none transition-all ${
                  isLight
                    ? 'bg-stone-50 border-stone-300 text-stone-900 focus:bg-white focus:border-rose-600'
                    : 'bg-slate-950 border-slate-800 text-white focus:border-rose-500'
                }`}
              />
            </div>
          </div>

          {/* Section Category */}
          <div>
            <label
              htmlFor="input-category"
              className={`block text-xs font-semibold mb-1.5 ${
                isLight ? 'text-stone-700' : 'text-slate-300'
              }`}
            >
              వార్తా విభాగం
            </label>
            <select
              id="input-category"
              value={suggestedCategory}
              onChange={(e) => setSuggestedCategory(e.target.value as NewspaperCategory)}
              className={`w-full px-3 py-2.5 text-xs font-medium rounded-xl border focus:outline-none transition-all cursor-pointer ${
                isLight
                  ? 'bg-stone-50 border-stone-300 text-stone-900 focus:bg-white focus:border-rose-600'
                  : 'bg-slate-950 border-slate-800 text-white focus:border-rose-500'
              }`}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.teluguLabel}
                </option>
              ))}
            </select>
          </div>

          {/* Telugu / English News Body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="input-telugu-body"
                className={`block text-xs font-semibold ${
                  isLight ? 'text-stone-700' : 'text-slate-300'
                }`}
              >
                వార్తా పూర్తి వివరాలు (తెలుగు లేదా ఆంగ్లం) *
              </label>
              <div className="flex items-center gap-2 text-xs">
                {containsTeluguUnicode(originalBodyTelugu) ? (
                  <>
                    <span className={isLight ? 'text-stone-500' : 'text-slate-400'}>తెలుగు అక్షరాలు:</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded-full text-xs ${
                        syllableCount > 200
                          ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                          : syllableCount >= 40
                          ? 'bg-amber-500/20 text-amber-600 border border-amber-500/30'
                          : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      {syllableCount}
                    </span>
                  </>
                ) : (
                  <>
                    <span className={isLight ? 'text-stone-500' : 'text-slate-400'}>English words:</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded-full text-xs ${
                        originalBodyTelugu.trim().length > 150
                          ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                          : originalBodyTelugu.trim().length >= 20
                          ? 'bg-amber-500/20 text-amber-600 border border-amber-500/30'
                          : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      {originalBodyTelugu.trim() ? originalBodyTelugu.trim().split(/\s+/).filter(Boolean).length : 0} ({originalBodyTelugu.trim().length} chars)
                    </span>
                  </>
                )}
              </div>
            </div>

            <textarea
              id="input-telugu-body"
              rows={7}
              value={originalBodyTelugu}
              onChange={(e) => setOriginalBodyTelugu(e.target.value)}
              placeholder="ఇక్కడ పూర్తి వార్తా వివరాలను తెలుగు లేదా ఆంగ్లంలో నమోదు చేయండి (Enter news report in Telugu or English)... AI will adapt and produce standard Telugu newspaper broadsheet output."
              className={`w-full px-3.5 py-2.5 text-sm font-telugu-serif leading-relaxed rounded-xl border focus:outline-none transition-all ${
                isLight
                  ? 'bg-stone-50 border-stone-300 text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-rose-600'
                  : 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus:border-rose-500'
              }`}
            />
            <p className={`mt-1.5 text-[11px] flex items-center gap-1.5 ${isLight ? 'text-stone-500' : 'text-slate-400'}`}>
              <Info className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>వార్తను తెలుగు లేదా ఆంగ్లంలో సమర్పించవచ్చు — పత్రికా ముద్రణ అవుట్‌పుట్ మాత్రం 100% ప్రామాణిక తెలుగు లిపిలోనే ముద్రితమవుతుంది.</span>
            </p>
          </div>

          {/* Photograph Upload */}
          <div
            className={`rounded-2xl p-4 space-y-3 border ${
              isLight ? 'bg-stone-50 border-stone-200' : 'bg-slate-950/90 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-semibold flex items-center gap-1.5 ${
                  isLight ? 'text-stone-800' : 'text-white'
                }`}
              >
                <Camera className="w-4 h-4 text-rose-600" />
                <span>వార్తా చిత్రం &amp; వివరణ (ఐచ్ఛికం)</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="photo-file-input"
                  className={`block text-xs mb-1 ${isLight ? 'text-stone-500' : 'text-slate-400'}`}
                >
                  చిత్రం అప్‌లోడ్ చేయండి (JPG / PNG)
                </label>
                <input
                  id="photo-file-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setSelectedFile(f);
                    if (f) setSamplePhotoTheme('');
                  }}
                  className={`w-full text-xs rounded-lg cursor-pointer ${
                    isLight
                      ? 'text-stone-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-stone-200 file:text-stone-700 file:text-xs file:font-semibold hover:file:bg-stone-300'
                      : 'text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200 file:text-xs file:font-semibold hover:file:bg-slate-700'
                  }`}
                />
              </div>

              <div>
                <label
                  htmlFor="sample-photo-select"
                  className={`block text-xs mb-1 ${isLight ? 'text-stone-500' : 'text-slate-400'}`}
                >
                  లేదా నమూనా ప్రెస్ చిత్రం ఎంచుకోండి
                </label>
                <select
                  id="sample-photo-select"
                  value={samplePhotoTheme}
                  onChange={(e) => {
                    setSamplePhotoTheme(e.target.value as typeof samplePhotoTheme);
                    if (e.target.value) setSelectedFile(null);
                  }}
                  className={`w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none cursor-pointer ${
                    isLight
                      ? 'bg-white border-stone-300 text-stone-700'
                      : 'bg-slate-900 border-slate-800 text-slate-200'
                  }`}
                >
                  <option value="">నమూనా చిత్రం అవసరం లేదు</option>
                  <option value="dam_water">ప్రాజెక్ట్ / రిజర్వాయర్ నీటి విడుదల దృశ్యం</option>
                  <option value="paddy_harvest">వ్యవసాయం &amp; ధాన్యం కొనుగోలు దృశ్యం</option>
                  <option value="smart_school">ప్రభుత్వ పాఠశాల &amp; విద్యా రంగం దృశ్యం</option>
                  <option value="metro_infra">రహదారులు &amp; మౌలిక వసతుల దృశ్యం</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="input-photo-caption"
                className={`block text-xs mb-1 ${isLight ? 'text-stone-500' : 'text-slate-400'}`}
              >
                ఫోటో వివరణ (క్యాప్షన్)
              </label>
              <input
                id="input-photo-caption"
                type="text"
                value={photoCaptionTelugu}
                onChange={(e) => setPhotoCaptionTelugu(e.target.value)}
                placeholder="ఉదా: విజయవాడ ప్రకాశం బ్యారేజీ వద్ద నీటి విడుదల దృశ్యం"
                className={`w-full px-3 py-1.5 text-xs font-telugu-sans rounded-lg border focus:outline-none ${
                  isLight
                    ? 'bg-white border-stone-300 text-stone-900 focus:border-rose-600'
                    : 'bg-slate-900 border-slate-800 text-slate-200 focus:border-rose-500'
                }`}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit(true)}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                isLight
                  ? 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>చిత్తుప్రతిగా భద్రపరచండి</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit(false)}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-lg shadow-rose-950/30 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 fill-current" />
              <span>{isSubmitting ? 'పరిశీలన జరుగుతోంది...' : 'వార్తను సమర్పించండి'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

