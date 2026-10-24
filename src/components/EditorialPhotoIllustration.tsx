import React, { useState } from 'react';

interface EditorialPhotoIllustrationProps {
  articleId: string;
  category: string;
  imageUrl?: string | null;
  altText: string;
  locationTelugu: string;
  heightClass?: string;
}

const TELEMETRY_BADGES: Record<string, { text: string; bg: string }> = {
  'art-krishna-delta': {
    text: 'ప్రకాశం బ్యారేజీ · ఇన్‌ఫ్లో: 7,700 క్యూసెక్కులు',
    bg: 'bg-[#7F1D1D]/90',
  },
  'art-guntur-grain': {
    text: 'మద్దతు ధర: రూ. 2,320 / క్వింటాల్ · 142 కేంద్రాలు',
    bg: 'bg-[#14532D]/90',
  },
  'art-amaravati-ev-buses': {
    text: 'రాజధాని ఇ-బస్సులు · 120 కొత్త సర్వీసులు',
    bg: 'bg-[#1E3A8A]/90',
  },
  'art-vizag-education': {
    text: '85 ప్రభుత్వ పాఠశాలల్లో 3D డిజిటల్ సైన్స్ ల్యాబ్స్',
    bg: 'bg-[#0F766E]/90',
  },
  'art-warangal-infra': {
    text: 'వరంగల్ రింగ్ రోడ్డు వంతెన · రూ. 410 కోట్లు',
    bg: 'bg-[#9A3412]/90',
  },
  'art-tirupati-health': {
    text: '24x7 పీహెచ్‌సీ వైద్యం · 65 రకాల ఉచిత పరీక్షలు',
    bg: 'bg-[#065F46]/90',
  },
};

export const EditorialPhotoIllustration: React.FC<EditorialPhotoIllustrationProps> = ({
  articleId,
  category,
  imageUrl,
  altText,
  locationTelugu,
  heightClass = 'h-48',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  // Use real full-color photojournalism for stories that have real photographic assets on disk
  const hasRealPhotographAsset =
    Boolean(imageUrl) &&
    !imgFailed &&
    !imageUrl?.includes('prakasam_barrage_gates.png');

  const isBarrage =
    articleId.includes('krishna') ||
    articleId.includes('barrage') ||
    category === 'State news';

  const badge = TELEMETRY_BADGES[articleId];

  return (
    <div className={`relative w-full ${heightClass} overflow-hidden bg-stone-900 select-none`}>
      {hasRealPhotographAsset ? (
        <>
          <img
            src={imageUrl!}
            alt={altText}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover block group-hover:scale-[1.02] transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/25 pointer-events-none" />
        </>
      ) : isBarrage ? (
        /* High-Resolution Prakasam Barrage Crest Gates & Krishna River Release Scene */
        <svg
          viewBox="0 0 640 340"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="skyBarrage" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1E3A8A" />
              <stop offset="48%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#FDE68A" />
            </linearGradient>
            <linearGradient id="waterFlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E0F2FE" />
              <stop offset="35%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#0369A1" />
            </linearGradient>
          </defs>
          <rect width="640" height="150" fill="url(#skyBarrage)" />
          <circle cx="515" cy="52" r="26" fill="#FEF08A" opacity="0.92" />
          {/* Indrakeeladri Hills Silhouette */}
          <path
            d="M0,145 Q95,82 205,126 T410,115 T640,136 L640,155 L0,155 Z"
            fill="#1E293B"
            opacity="0.82"
          />
          {/* Prakasam Barrage Iconic Arch Bridge & Crest Gates */}
          <rect x="0" y="138" width="640" height="14" fill="#991B1B" />
          <rect x="0" y="150" width="640" height="8" fill="#F59E0B" />
          {Array.from({ length: 12 }).map((_, i) => {
            const x = i * 54;
            return (
              <g key={i}>
                <rect x={x + 10} y="158" width="36" height="36" fill="#334155" />
                <line
                  x1={x + 12}
                  y1="164"
                  x2={x + 44}
                  y2="188"
                  stroke="#94A3B8"
                  strokeWidth="1.5"
                />
                <rect x={x} y="136" width="12" height="72" fill="#D6D3D1" />
                <rect x={x + 2} y="136" width="4" height="72" fill="#F5F5F4" />
                <path
                  d={`M${x + 10},184 Q${x + 28},176 ${x + 46},184 L${x + 52},265 L${x + 4},265 Z`}
                  fill="#F0F9FF"
                  opacity="0.9"
                />
              </g>
            );
          })}
          {/* Foaming Krishna River Basin */}
          <rect x="0" y="206" width="640" height="134" fill="url(#waterFlow)" />
          {Array.from({ length: 18 }).map((_, i) => (
            <path
              key={i}
              d={`M${(i * 42) % 600},${215 + (i % 5) * 22} Q${((i * 42) % 600) + 35},${
                207 + (i % 5) * 22
              } ${((i * 42) % 600) + 70},${215 + (i % 5) * 22}`}
              stroke="#FFFFFF"
              strokeWidth="2.5"
              fill="none"
              opacity="0.78"
            />
          ))}
        </svg>
      ) : (
        <svg
          viewBox="0 0 640 340"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="skyGeneric" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1E3A8A" />
              <stop offset="100%" stopColor="#0F766E" />
            </linearGradient>
          </defs>
          <rect width="640" height="340" fill="url(#skyGeneric)" />
          <circle cx="520" cy="80" r="90" fill="#FFFFFF" opacity="0.08" />
          <circle cx="140" cy="260" r="120" fill="#FEF08A" opacity="0.1" />
        </svg>
      )}

      {/* Bottom-Right Authentic Telugu Newspaper Bureau Photo Credit Tag */}
      <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white px-2 py-0.5 font-telugu-sans text-[10px] tracking-wide border border-white/20">
        {locationTelugu} · ప్రజా వాణి ఫోటో
      </div>
    </div>
  );
};
