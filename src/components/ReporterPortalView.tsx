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
} from 'lucide-react';
import type {
  Article,
  CategoryConfig,
  NewspaperCategory,
  User,
} from '../shared/types.ts';

interface ReporterPortalViewProps {
  currentUser: User;
  users: User[];
  categories: CategoryConfig[];
  articles: Article[];
  onSwitchUser: (userId: string) => Promise<void>;
  onArticleCreated: (article: Article, jobId?: string) => void;
  onInspectArticle: (articleId: string) => void;
}

const SAMPLE_TELUGU_TEMPLATES = [
  {
    label: 'తిరుపతి బ్రహ్మోత్సవాల ఏర్పాట్లు (Culture)',
    headline: 'తిరుమల శ్రీవారి బ్రహ్మోత్సవాలకు విస్తృత ఏర్పాట్లు — భక్తులకు ప్రత్యేక దర్శన క్యూలైన్లు',
    location: 'తిరుపతి',
    district: 'తిరుపతి జిల్లా',
    category: 'Culture and festivals' as NewspaperCategory,
    photoTheme: 'smart_school' as const,
    photoCaption: 'తిరుపతిలో భక్తుల సౌకర్యార్థం ఏర్పాటు చేసిన సమాచార మరియు సేవా కేంద్రం',
    body: 'తిరుపతి: తిరుమల శ్రీ వేంకటేశ్వర స్వామి వార్షిక బ్రహ్మోత్సవాలను పురస్కరించుకుని భక్తులకు ఎలాంటి అసౌకర్యం కలగకుండా టీటీడీ మరియు జిల్లా అధికార యంత్రాంగం విస్తృత ఏర్పాట్లు పూర్తి చేసింది. రోజుకు 80,000 మందికి పైగా భక్తులు దర్శించుకునే అవకాశం ఉన్నందున అదనంగా 45 ఉచిత అన్నప్రసాద కౌంటర్లు, 12 ప్రథమ చికిత్సా కేంద్రాలను ఏర్పాటు చేశారు. తిరుపతి రైల్వే స్టేషన్ మరియు బస్టాండ్ నుంచి ఘాట్ రోడ్డు మీదుగా ప్రతి రెండు నిమిషాలకు ఒక ఆర్టీసీ బస్సు నడిపేలా రవాణా విభాగం చర్యలు తీసుకుంది.',
  },
  {
    label: 'భీమవరం ఆక్వా రైతులకు సబ్సిడీ (Agriculture)',
    headline: 'పశ్చిమ గోదావరి ఆక్వా రైతులకు విద్యుత్ సబ్సిడీ పెంపు — 18,500 మందికి లబ్ధి',
    location: 'భీమవరం',
    district: 'పశ్చిమ గోదావరి',
    category: 'Agriculture' as NewspaperCategory,
    photoTheme: 'paddy_harvest' as const,
    photoCaption: 'భీమవరం పరిసర ప్రాంతాల్లో సాగునీటి చెరువులను పరిశీలిస్తున్న మత్స్యశాఖ అధికారులు',
    body: 'భీమవరం: పశ్చిమ గోదావరి జిల్లాలోని ఆక్వా రైతులకు ఊరటనిస్తూ ప్రభుత్వం యూనిట్ విద్యుత్ ధరను రూ. 1.50 కే అందించే పథకాన్ని మరో 3,200 ఎకరాలకు విస్తరించింది. దీనివల్ల జిల్లాలోని 18,500 మంది చిన్న, సన్నకారు ఆక్వా రైతులకు ప్రత్యక్షంగా లబ్ధి చేకూరుతుందని మత్స్యశాఖ జాయింట్ డైరెక్టర్ తెలిపారు. నాణ్యమైన రొయ్యల సీడ్ మరియు ఫీడ్ ధరల నియంత్రణ కోసం జిల్లా స్థాయిలో 8 తనిఖీ బృందాలను ఏర్పాటు చేశారు.',
  },
  {
    label: 'అమరావతి సౌర విద్యుత్ ప్రాజెక్టు (Public services)',
    headline: 'ప్రభుత్వ కార్యాలయాలపై 25 మెగావాట్ల రూఫ్‌టాప్ సౌర విద్యుత్ ప్లాంట్ల ఏర్పాటు',
    location: 'అమరావతి',
    district: 'గుంటూరు',
    category: 'Public services' as NewspaperCategory,
    photoTheme: 'metro_infra' as const,
    photoCaption: 'అమరావతి సచివాలయ భవన సముదాయంపై ఏర్పాటు చేసిన సౌర విద్యుత్ ప్యానెళ్లు',
    body: 'అమరావతి: రాష్ట్రంలోని ప్రభుత్వ కార్యాలయాలు మరియు విద్యా సంస్థల భవనాలపై 25 మెగావాట్ల సామర్థ్యం గల రూఫ్‌టాప్ సౌర విద్యుత్ ప్లాంట్లను వచ్చే మూడు నెలల్లో ఏర్పాటు చేయనున్నట్లు నెడ్‌క్యాప్ (NREDCAP) అధికారులు వెల్లడించారు. రూ. 115 కోట్ల వ్యయంతో చేపట్టిన ఈ ప్రాజెక్టు ద్వారా ప్రభుత్వ కార్యాలయాల కరెంటు బిల్లులు ఏటా రూ. 28 కోట్ల మేర ఆదా అవుతాయని అంచనా వేశారు.',
  },
];

export const ReporterPortalView: React.FC<ReporterPortalViewProps> = ({
  currentUser,
  users,
  categories,
  articles,
  onSwitchUser,
  onArticleCreated,
  onInspectArticle,
}) => {
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

  const myArticles = articles.filter((a) =>
    currentUser.role === 'editor' ? true : a.reporterId === currentUser.id
  );

  const applyTemplate = (tpl: (typeof SAMPLE_TELUGU_TEMPLATES)[number]) => {
    setOriginalHeadline(tpl.headline);
    setOriginalBodyTelugu(tpl.body);
    setLocation(tpl.location);
    setDistrict(tpl.district);
    setSuggestedCategory(tpl.category);
    setSamplePhotoTheme(tpl.photoTheme);
    setPhotoCaptionTelugu(tpl.photoCaption);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (saveAsDraft: boolean) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
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
          autoProcess: false, // Upload photo first before triggering pipeline
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createData.error || 'Failed to submit Telugu article.');
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
        const assetData = await assetRes.json();
        if (!assetRes.ok) {
          throw new Error(assetData.error || 'Photograph binary validation failed.');
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
        const assetData = await assetRes.json();
        if (!assetRes.ok) {
          throw new Error(assetData.error || 'Sample photo attachment failed.');
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
        const procData = await procRes.json();
        if (procRes.ok && procData.jobId) {
          jobId = procData.jobId;
        }
      }

      const refreshedRes = await fetch(`/api/articles/${createdArticle.id}`);
      const refreshedData = await refreshedRes.json();

      setSuccessMsg(
        saveAsDraft
          ? `Draft saved (${createdArticle.id}). You can edit and submit it anytime.`
          : `Submitted ${createdArticle.id} and started dual-model AI pipeline (Gemma 4 31B -> Gemini 3.5 Flash-Lite).`
      );
      setOriginalHeadline('');
      setOriginalBodyTelugu('');
      setSelectedFile(null);
      onArticleCreated(refreshedData.article || createdArticle, jobId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 7 Cols: Telugu News Submission Form */}
      <div className="lg:col-span-7 bg-white border border-stone-200 p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              విలేకరి వార్తా సమర్పణ (Reporter Story Submission)
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Submit Unicode Telugu dispatches and verified photographs for Gemma 4 31B & Gemini 3.5 Flash-Lite processing
            </p>
          </div>

          {/* Reporter Identity Switcher */}
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#9A3412]" />
            <label htmlFor="reporter-login-select" className="sr-only">
              Active Reporter
            </label>
            <select
              id="reporter-login-select"
              value={currentUser.id}
              onChange={(e) => onSwitchUser(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-medium bg-stone-50 border border-stone-300 text-stone-900"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName} — {u.role.toUpperCase()} ({u.district})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* One-Click Representative Telugu Templates for Fast Testing */}
        <div className="bg-stone-50 border border-stone-200 p-3 space-y-2">
          <div className="text-xs font-medium text-stone-700">
            Quick Fill Representative Telugu Dispatches (నమూనా తెలుగు వార్తలు):
          </div>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_TELUGU_TEMPLATES.map((tpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="px-2.5 py-1.5 text-xs font-telugu-sans font-medium bg-white border border-stone-300 text-stone-800 hover:border-[#9A3412] hover:text-[#9A3412] transition-colors cursor-pointer"
              >
                + {tpl.label}
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="input-headline" className="block text-xs font-medium text-stone-700 mb-1">
              Original Telugu Headline (ఐచ్ఛిక శీర్షిక — Optional)
            </label>
            <input
              id="input-headline"
              type="text"
              value={originalHeadline}
              onChange={(e) => setOriginalHeadline(e.target.value)}
              placeholder="ఉదా: గుంటూరు జిల్లాలో నేటి నుంచే ధాన్యం కొనుగోలు కేంద్రాలు..."
              className="w-full px-3 py-2 text-sm font-telugu-sans bg-white border border-stone-300 text-stone-900 focus:outline-none focus:border-stone-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="input-location" className="block text-xs font-medium text-stone-700 mb-1">
                Town / Village / City (స్థలం) *
              </label>
              <input
                id="input-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="విజయవాడ"
                className="w-full px-3 py-2 text-sm font-telugu-sans bg-white border border-stone-300 text-stone-900 focus:outline-none focus:border-stone-900"
              />
            </div>

            <div>
              <label htmlFor="input-district" className="block text-xs font-medium text-stone-700 mb-1">
                District (జిల్లా) *
              </label>
              <input
                id="input-district"
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="ఎన్టీఆర్ జిల్లా"
                className="w-full px-3 py-2 text-sm font-telugu-sans bg-white border border-stone-300 text-stone-900 focus:outline-none focus:border-stone-900"
              />
            </div>

            <div>
              <label htmlFor="input-event-date" className="block text-xs font-medium text-stone-700 mb-1">
                Event Date (తేదీ) *
              </label>
              <input
                id="input-event-date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-stone-300 text-stone-900 focus:outline-none focus:border-stone-900"
              />
            </div>
          </div>

          <div>
            <label htmlFor="input-category" className="block text-xs font-medium text-stone-700 mb-1">
              Suggested Section Category (సూచించే విభాగం)
            </label>
            <select
              id="input-category"
              value={suggestedCategory}
              onChange={(e) => setSuggestedCategory(e.target.value as NewspaperCategory)}
              className="w-full px-3 py-2 text-xs font-medium bg-white border border-stone-300 text-stone-900 focus:outline-none focus:border-stone-900"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.teluguLabel} — {cat.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="input-telugu-body" className="block text-xs font-medium text-stone-700 mb-1">
              Original Telugu News Report (మూల తెలుగు వార్తా పాఠ్యం — Unicode Telugu) *
            </label>
            <textarea
              id="input-telugu-body"
              rows={6}
              value={originalBodyTelugu}
              onChange={(e) => setOriginalBodyTelugu(e.target.value)}
              placeholder="ఇక్కడ పూర్తి తెలుగు వార్తా వివరాలను నమోదు చేయండి..."
              className="w-full px-3.5 py-2.5 text-sm font-telugu-serif leading-relaxed bg-white border border-stone-300 text-stone-900 focus:outline-none focus:border-stone-900"
            />
          </div>

          {/* Photograph Upload & Binary Validation Section */}
          <div className="border border-stone-200 bg-stone-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-[#9A3412]" />
                Photograph Attachment & Caption (ఫోటో మరియు క్యాప్షన్)
              </span>
              <span className="text-[11px] text-stone-500">
                Binary header decoded (PNG / JPEG / WebP, min 240×160px)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="photo-file-input" className="block text-xs text-stone-600 mb-1">
                  Upload File (JPG, PNG, WebP)
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
                  className="w-full text-xs text-stone-700 file:mr-2 file:py-1.5 file:px-3 file:border file:border-stone-300 file:bg-white file:text-xs file:font-medium"
                />
              </div>

              <div>
                <label htmlFor="sample-photo-select" className="block text-xs text-stone-600 mb-1">
                  Or Attach Verified Press Photo Binary
                </label>
                <select
                  id="sample-photo-select"
                  value={samplePhotoTheme}
                  onChange={(e) => {
                    setSamplePhotoTheme(e.target.value as typeof samplePhotoTheme);
                    if (e.target.value) setSelectedFile(null);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 text-stone-800"
                >
                  <option value="">No Press Preset Selected</option>
                  <option value="dam_water">Reservoir / Barrage Water Release (560×350 PNG)</option>
                  <option value="paddy_harvest">Agricultural Paddy Procurement (560×350 PNG)</option>
                  <option value="smart_school">Government School / Public Event (560×350 PNG)</option>
                  <option value="metro_infra">Highway & Urban Infrastructure (560×350 PNG)</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="input-photo-caption" className="block text-xs text-stone-600 mb-1">
                Verified Telugu Photo Caption (ఫోటో వివరణ)
              </label>
              <input
                id="input-photo-caption"
                type="text"
                value={photoCaptionTelugu}
                onChange={(e) => setPhotoCaptionTelugu(e.target.value)}
                placeholder="ఉదా: విజయవాడ ప్రకాశం బ్యారేజీ వద్ద నీటి విడుదల దృశ్యం"
                className="w-full px-3 py-1.5 text-xs font-telugu-sans bg-white border border-stone-300 text-stone-900"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit(true)}
              className="px-4 py-2 text-xs font-medium bg-stone-100 text-stone-800 border border-stone-300 hover:bg-stone-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              Save as Draft
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit(false)}
              className="px-5 py-2 text-xs font-semibold bg-[#9A3412] text-white hover:bg-[#7C2D12] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? 'Submitting & Starting AI Pipeline...' : 'Submit Story for AI Processing'}
            </button>
          </div>
        </div>
      </div>

      {/* Right 5 Cols: Reporter's Submitted Stories & Live Processing Status */}
      <div className="lg:col-span-5 bg-white border border-stone-200 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">
              Submitted Dispatches ({myArticles.length})
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Showing stories for {currentUser.displayNameTelugu}
            </p>
          </div>
        </div>

        <div className="divide-y divide-stone-200">
          {myArticles.map((art) => (
            <div key={art.id} className="py-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span>
                  {art.assignedCategoryTelugu} · {art.location} · Rev #{art.currentRevision}
                </span>
                <span className="font-mono-tabular">
                  Priority: {art.priorityScore}/100 · {art.status.toUpperCase()}
                </span>
              </div>

              <h4 className="font-telugu-sans font-bold text-sm text-stone-900 leading-snug">
                {art.primaryHeadlineTelugu || art.originalHeadline || 'శీర్షిక లేని వార్త'}
              </h4>

              <p className="font-telugu-serif text-xs text-stone-600 line-clamp-2">
                {art.summaryTelugu || art.originalBodyTelugu}
              </p>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-stone-500">
                  Photos: {art.assets?.length || 0} · Warnings: {art.validationWarnings.length}
                </span>
                <button
                  type="button"
                  onClick={() => onInspectArticle(art.id)}
                  className="text-xs font-semibold text-[#9A3412] hover:underline cursor-pointer"
                >
                  Inspect AI Output & Revisions →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
