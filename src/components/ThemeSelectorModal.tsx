import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Palette,
  Search,
  Check,
  X,
  RotateCcw,
  Sun,
  Moon,
  Sparkles,
  Layers,
} from 'lucide-react';
import type { ThemeDefinition, ThemeMode } from '../themes/themeTypes.ts';
import {
  THEMES_CATALOG,
  THEME_CATEGORIES,
  STANDARD_THEME_ID,
} from '../themes/themeCatalog.ts';
import { useToast } from './ToastNotification.tsx';

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentThemeId: string;
  onSelectTheme: (theme: ThemeDefinition) => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({
  isOpen,
  onClose,
  currentThemeId,
  onSelectTheme,
}) => {
  const { addToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<'all' | ThemeMode>('all');

  // Filtered themes list
  const filteredThemes = useMemo(() => {
    return THEMES_CATALOG.filter((theme) => {
      // Category filter
      if (selectedCategory !== 'all' && theme.category !== selectedCategory) {
        return false;
      }
      // Mode filter
      if (modeFilter !== 'all' && theme.mode !== modeFilter) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = theme.name.toLowerCase().includes(q);
        const matchesTelugu = theme.nameTelugu.toLowerCase().includes(q);
        const matchesDesc = theme.description.toLowerCase().includes(q);
        const matchesCategory = theme.categoryTelugu.toLowerCase().includes(q);
        if (!matchesName && !matchesTelugu && !matchesDesc && !matchesCategory) {
          return false;
        }
      }
      return true;
    });
  }, [searchQuery, selectedCategory, modeFilter]);

  const handleApplyTheme = (theme: ThemeDefinition) => {
    onSelectTheme(theme);
    addToast({
      type: 'success',
      title: 'థీమ్ మార్చబడింది',
      message: `${theme.nameTelugu} (${theme.name}) విజయవంతంగా వర్తించబడింది.`,
      duration: 2500,
    });
  };

  const handleResetToStandard = () => {
    const standard = THEMES_CATALOG.find((t) => t.id === STANDARD_THEME_ID) || THEMES_CATALOG[0];
    onSelectTheme(standard);
    addToast({
      type: 'info',
      title: 'ప్రామాణిక థీమ్‌కి మార్చబడింది',
      message: 'ప్రజా వాణి సహజ పత్రికా ముద్రణ శైలి పునరుద్ధరించబడింది.',
      duration: 2500,
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-hidden select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-slate-100 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 via-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-rose-950/50">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white font-telugu-sans">
                    థీమ్స్ గ్యాలరీ — 100 ప్రత్యేక వర్ణ శైలులు
                  </h2>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    100 THEMES
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  వార్తాపత్రిక, తెలుగు ప్రాంతీయ వారసత్వం, డెవలపర్ డార్క్ మరియు ఆధునిక లైట్ శైలులు
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetToStandard}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
                title="ప్రామాణిక థీమ్‌కి మార్చండి"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ప్రామాణిక శైలి (Standard)</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
                title="మూసివేయండి"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 space-y-3 shrink-0">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="థీమ్ పేరు, వర్గం లేదా వివరణ శోధించండి (ఉదా: న్యూస్‌ప్రింట్, చార్మినార్, డ్రాక్యులా, లైట్)..."
                  className="w-full pl-10 pr-9 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Mode Toggle Pills (All / Light / Dark) */}
              <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setModeFilter('all')}
                  className={`px-3 py-1 rounded-lg transition font-medium cursor-pointer ${
                    modeFilter === 'all'
                      ? 'bg-rose-600 text-white font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  అన్నీ (All)
                </button>
                <button
                  type="button"
                  onClick={() => setModeFilter('light')}
                  className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1 cursor-pointer ${
                    modeFilter === 'light'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>లైట్</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModeFilter('dark')}
                  className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1 cursor-pointer ${
                    modeFilter === 'dark'
                      ? 'bg-indigo-600 text-white font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>డార్క్</span>
                </button>
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-thin">
              {THEME_CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.id;
                const count =
                  cat.id === 'all'
                    ? THEMES_CATALOG.length
                    : THEMES_CATALOG.filter((t) => t.category === cat.id).length;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer text-xs flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 font-bold shadow'
                        : 'bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span>{cat.labelTelugu}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive ? 'bg-slate-900 text-slate-100' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme Cards Grid */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>
                {filteredThemes.length} థీమ్‌లు ప్రదర్శించబడుతున్నాయి (మొత్తం 100 లో)
              </span>
              {currentThemeId && (
                <span className="flex items-center gap-1 text-slate-400">
                  <span>ప్రస్తుత థీమ్:</span>
                  <strong className="text-rose-400 font-telugu-sans">
                    {THEMES_CATALOG.find((t) => t.id === currentThemeId)?.nameTelugu ||
                      currentThemeId}
                  </strong>
                </span>
              )}
            </div>

            {filteredThemes.length === 0 ? (
              <div className="text-center py-16 bg-slate-950/50 border border-slate-800 rounded-2xl p-8">
                <Sparkles className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-white">ఎలాంటి థీమ్ కనుగొనబడలేదు</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  మీ శోధనకు తగిన ఫలితాలు లేవు. దయచేసి వేరే పేరు లేదా వర్గం ఎంచుకోండి.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setModeFilter('all');
                  }}
                  className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-white rounded-xl cursor-pointer"
                >
                  అన్ని ఫిల్టర్‌లను తొలగించండి
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredThemes.map((theme) => {
                  const isActive = theme.id === currentThemeId;
                  const isStandard = theme.id === STANDARD_THEME_ID;
                  const c = theme.colors;

                  return (
                    <div
                      key={theme.id}
                      onClick={() => handleApplyTheme(theme)}
                      className={`group relative rounded-2xl p-4 transition-all duration-200 border cursor-pointer flex flex-col justify-between overflow-hidden ${
                        isActive
                          ? 'border-rose-500 ring-2 ring-rose-500/30 bg-slate-800/90 shadow-xl shadow-rose-950/40'
                          : 'border-slate-800/90 bg-slate-950/70 hover:bg-slate-900 hover:border-slate-700 shadow-md'
                      }`}
                    >
                      {/* Active Indicator Strip */}
                      {isActive && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />
                      )}

                      <div>
                        {/* Mini Theme Canvas Preview Box */}
                        <div
                          className="w-full h-16 rounded-xl border p-2 mb-3 flex flex-col justify-between overflow-hidden shadow-inner transition group-hover:scale-[1.01]"
                          style={{
                            backgroundColor: c.bgPage,
                            borderColor: c.border,
                            color: c.textPrimary,
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: c.primary }}
                              />
                              <span
                                className="text-[10px] font-bold tracking-tight truncate max-w-[120px]"
                                style={{ color: c.textPrimary }}
                              >
                                ప్రజా వాణి
                              </span>
                            </div>
                            <span
                              className="text-[8px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider"
                              style={{
                                backgroundColor: c.tagBg,
                                color: c.tagText,
                              }}
                            >
                              {theme.mode}
                            </span>
                          </div>

                          <div
                            className="rounded p-1 text-[9px] truncate flex items-center justify-between"
                            style={{
                              backgroundColor: c.bgSurface,
                              color: c.textSecondary,
                              border: `1px solid ${c.borderSubtle}`,
                            }}
                          >
                            <span className="truncate">{theme.name}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: c.primary }}
                              />
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: c.accent }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Theme Metadata */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold text-white font-telugu-sans group-hover:text-rose-400 transition">
                                {theme.nameTelugu}
                              </h4>
                              {isStandard && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  ప్రామాణికం
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {theme.name}
                            </p>
                          </div>

                          {isActive ? (
                            <span className="shrink-0 w-5 h-5 rounded-full bg-rose-600 flex items-center justify-center text-white shadow">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          ) : (
                            <span className="shrink-0 text-[10px] text-slate-500 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                              {theme.mode === 'light' ? 'లైట్' : 'డార్క్'}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                          {theme.description}
                        </p>
                      </div>

                      {/* Swatches Palette */}
                      <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                        <span className="text-slate-400">{theme.categoryTelugu}</span>
                        <div className="flex items-center gap-1">
                          <span
                            className="w-3 h-3 rounded-full border border-black/20 shadow-sm"
                            style={{ backgroundColor: c.bgPage }}
                            title={`Page: ${c.bgPage}`}
                          />
                          <span
                            className="w-3 h-3 rounded-full border border-black/20 shadow-sm"
                            style={{ backgroundColor: c.bgSurface }}
                            title={`Surface: ${c.bgSurface}`}
                          />
                          <span
                            className="w-3 h-3 rounded-full border border-black/20 shadow-sm"
                            style={{ backgroundColor: c.primary }}
                            title={`Primary: ${c.primary}`}
                          />
                          <span
                            className="w-3 h-3 rounded-full border border-black/20 shadow-sm"
                            style={{ backgroundColor: c.accent }}
                            title={`Accent: ${c.accent}`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 shrink-0">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-rose-500" />
              <span>మొత్తం 100 ప్రత్యేక వర్ణ శైలులు అందుబాటులో ఉన్నాయి. ఎంచుకున్న థీమ్ తక్షణమే వర్తిస్తుంది.</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetToStandard}
                className="px-3 py-1 text-xs text-amber-400 hover:text-amber-300 transition cursor-pointer"
              >
                ప్రామాణిక థీమ్ రీసెట్ చేయండి
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition cursor-pointer"
              >
                పూర్తయింది (Close)
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
