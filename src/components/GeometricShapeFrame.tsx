import React from 'react';
import type {
  GeometricShapeSpec,
  GeometricShapeType,
  LayoutModule,
} from '../shared/types.ts';
import { GEOMETRIC_SHAPE_CATALOG } from '../engine/geometric-shapes.ts';
import { EditorialPhotoIllustration } from './EditorialPhotoIllustration.tsx';

interface ShapedPhotoOrMedallionProps {
  module: LayoutModule;
  shapeType: GeometricShapeType;
  accentColorHex: string;
  mode: 'floated_text_wrap' | 'banner_frame';
  floatDirection?: 'left' | 'right';
}

export const ShapedPhotoOrMedallion: React.FC<ShapedPhotoOrMedallionProps> = ({
  module,
  shapeType,
  accentColorHex,
  mode,
  floatDirection = 'left',
}) => {
  const spec: GeometricShapeSpec =
    GEOMETRIC_SHAPE_CATALOG[shapeType] || GEOMETRIC_SHAPE_CATALOG.rectangle;
  const isNonRect = shapeType !== 'rectangle';

  if (mode === 'floated_text_wrap' && isNonRect) {
    const floatSizePx =
      shapeType === 'circle' || shapeType === 'rhombus_diamond' || shapeType === 'star_burst'
        ? 176
        : shapeType === 'pentagon_shield' || shapeType === 'hexagon_gem'
        ? 184
        : 188;

    return (
      <div
        style={{
          float: floatDirection,
          width: `${floatSizePx}px`,
          height: `${floatSizePx}px`,
          shapeOutside: spec.shape_outside_css,
          WebkitShapeOutside: spec.shape_outside_css,
          shapeMargin: '12px',
          marginRight: floatDirection === 'left' ? '16px' : '0px',
          marginLeft: floatDirection === 'right' ? '16px' : '0px',
          marginBottom: '10px',
        }}
        className="relative select-none shrink-0 group/shape"
      >
        {/* Clipped Geometric Image & Content Area */}
        <div
          style={{
            clipPath: spec.clip_path_css,
            WebkitClipPath: spec.clip_path_css,
          }}
          className="w-full h-full relative overflow-hidden bg-stone-900 shadow-md"
        >
          <EditorialPhotoIllustration
            articleId={module.articleId}
            category={module.sectionCategory}
            imageUrl={module.photographUrl}
            altText={module.photographCaptionTelugu || module.headlineTextTelugu}
            locationTelugu={module.locationDatelineTelugu}
            heightClass="h-full"
          />

          {/* Bottom Gradient & Telugu Callout Inside the Geometric Shape */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent pt-6 pb-2.5 px-3 text-center">
            <div className="font-telugu-sans text-[10px] font-bold text-amber-300 leading-tight truncate">
              {module.geometricShape?.badge_title_telugu || module.sectionLabelTelugu}
            </div>
            <div className="font-telugu-sans text-[11px] font-extrabold text-white leading-tight truncate">
              {module.geometricShape?.badge_value_telugu || module.locationDatelineTelugu}
            </div>
          </div>
        </div>

        {/* Crisp Vector SVG Polygon / Circle Contour Ring */}
        {spec.svg_border_path && (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="
              pointer-events-none absolute inset-0 w-full h-full z-10
            "
          >
            <path
              d={spec.svg_border_path}
              fill="none"
              stroke={accentColorHex}
              strokeWidth="3.2"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={spec.svg_border_path}
              fill="none"
              stroke="#FDE68A"
              strokeWidth="1"
              strokeDasharray="3 2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>
    );
  }

  // Banner / Feature Frame Mode (supports Tomb Arch, Semi-Circle Dome, Pentagon, Circle, etc.)
  return (
    <div className="relative">
      <div
        style={
          isNonRect
            ? {
                clipPath: spec.clip_path_css,
                WebkitClipPath: spec.clip_path_css,
              }
            : undefined
        }
        className={`relative overflow-hidden bg-stone-900 ${
          isNonRect ? '' : 'border border-stone-400'
        }`}
      >
        <EditorialPhotoIllustration
          articleId={module.articleId}
          category={module.sectionCategory}
          imageUrl={module.photographUrl}
          altText={module.photographCaptionTelugu || module.headlineTextTelugu}
          locationTelugu={module.locationDatelineTelugu}
          heightClass={module.isLeadStory ? 'h-52' : 'h-44'}
        />

        {spec.svg_border_path && isNonRect && (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 w-full h-full z-10"
          >
            <path
              d={spec.svg_border_path}
              fill="none"
              stroke={accentColorHex}
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>

      {/* Geometric Shape Badge Pill */}
      {isNonRect && (
        <div
          style={{ backgroundColor: accentColorHex }}
          className="inline-flex items-center gap-1.5 text-white font-telugu-sans text-[10px] font-bold px-2 py-0.5 mt-1"
        >
          <span>ఆకృతి: {spec.label_telugu}</span>
        </div>
      )}
    </div>
  );
};

interface BroadsheetGeometricMedallionShowcaseProps {
  modules: LayoutModule[];
  onSelectModule: (mod: LayoutModule) => void;
}

/**
 * Renders an authentic Eenadu-style "Geometric Cutout & Medallion Ribbon"
 * demonstrating Circle, Part-of-Circle (Semi-Circle Arch), Tomb Arch Square,
 * Pentagon Shield, and Starburst/Rhombus Diamond areas with positioned Telugu text & imagery.
 */
export const BroadsheetGeometricMedallionShowcase: React.FC<
  BroadsheetGeometricMedallionShowcaseProps
> = ({ modules, onSelectModule }) => {
  if (modules.length === 0) return null;

  const pickMod = (idx: number) => modules[idx % modules.length];

  const showcaseItems: {
    shapeType: GeometricShapeType;
    badgeTelugu: string;
    titleTelugu: string;
    statTelugu: string;
    accentHex: string;
    bgHex: string;
    mod: LayoutModule;
  }[] = [
    {
      shapeType: 'circle',
      badgeTelugu: 'వృత్తాకార బింబం · CIRCLE',
      titleTelugu: 'విశాఖలో 85 డిజిటల్ స్మార్ట్ పాఠశాలలు ప్రారంభం',
      statTelugu: '24,500 మంది విద్యార్థులకు లబ్ధి',
      accentHex: '#1E40AF',
      bgHex: '#EFF6FF',
      mod: modules.find((m) => m.articleId.includes('vizag')) || pickMod(0),
    },
    {
      shapeType: 'semi_circle_arch',
      badgeTelugu: 'అర్ధ వృత్తాకార ఆర్చ్ · PART OF CIRCLE',
      titleTelugu: 'ప్రకాశం బ్యారేజీ నుంచి 7,700 క్యూసెక్కుల విడుదల',
      statTelugu: '13.08 లక్షల ఎకరాలకు సాగునీరు',
      accentHex: '#991B1B',
      bgHex: '#FEF2F2',
      mod: modules.find((m) => m.articleId.includes('krishna')) || pickMod(1),
    },
    {
      shapeType: 'tomb_arch',
      badgeTelugu: 'గోపుర ఆర్చ్ పెట్టె · TOMB SQUARE',
      titleTelugu: 'బెజవాడలో కూచిపూడి మహా నాట్యోత్సవ వేడుకలు',
      statTelugu: '450 మంది కళాకారుల అభినయం',
      accentHex: '#9F1239',
      bgHex: '#FFF1F2',
      mod: modules.find((m) => m.articleId.includes('kuchipudi')) || pickMod(2),
    },
    {
      shapeType: 'pentagon_shield',
      badgeTelugu: 'పంచభుజి షీల్డ్ · PENTAGON',
      titleTelugu: 'గుంటూరులో 142 ధాన్యం కొనుగోలు కేంద్రాలు',
      statTelugu: 'క్వింటాల్‌కు రూ. 2,320 మద్దతు ధర',
      accentHex: '#15803D',
      bgHex: '#F0FDF4',
      mod: modules.find((m) => m.articleId.includes('guntur')) || pickMod(3),
    },
    {
      shapeType: 'star_burst',
      badgeTelugu: 'నక్షత్ర & వజ్రాకృతి · STAR / DIAMOND',
      titleTelugu: 'రాయలసీమ బిందు సేద్యానికి రూ. 640 కోట్లు',
      statTelugu: '90% రాయితీతో పరికరాల పంపిణీ',
      accentHex: '#B45309',
      bgHex: '#FFFBEB',
      mod: modules.find((m) => m.articleId.includes('rayalaseema')) || pickMod(4),
    },
  ];

  return (
    <section
      aria-label="Geometric Newspaper Medallions and Shaped Cutouts"
      className="my-3.5 p-3 bg-[#F3EFE6] border-2 border-stone-800"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-3 border-b border-stone-400">
        <div className="flex items-center gap-2">
          <span className="bg-[#991B1B] text-white font-telugu-sans text-[11px] font-extrabold px-2.5 py-0.5">
            విశేష జ్యామితీయ ఆకృతుల వార్తా బింబాలు
          </span>
          <span className="font-telugu-sans text-xs font-bold text-stone-800">
            వృత్తం (Circle) · అర్ధ వృత్తం (Part-of-Circle) · గోపుర ఆర్చ్ (Tomb Square) · పంచభుజి (Pentagon) · నక్షత్ర ముద్ర (Starburst)
          </span>
        </div>
        <span className="font-mono-tabular text-[10.5px] font-semibold text-stone-600">
          Click any geometric shape to inspect or customize contour
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-stretch">
        {showcaseItems.map((item, idx) => {
          const spec = GEOMETRIC_SHAPE_CATALOG[item.shapeType];
          return (
            <div
              key={idx}
              onClick={() => onSelectModule(item.mod)}
              className="group cursor-pointer bg-white border border-stone-300 p-2.5 flex flex-col items-center text-center justify-between hover:border-stone-900 transition-all"
            >
              <div className="w-full flex items-center justify-center mb-1.5">
                <span
                  style={{ backgroundColor: item.accentHex }}
                  className="text-white font-telugu-sans text-[9.5px] font-extrabold px-2 py-0.5 tracking-tight"
                >
                  {item.badgeTelugu}
                </span>
              </div>

              {/* Geometric Shape Visual Area with Positioned Image + Overlay Badge */}
              <div className="relative w-32 h-32 my-1 shrink-0">
                <div
                  style={{
                    clipPath: spec.clip_path_css,
                    WebkitClipPath: spec.clip_path_css,
                  }}
                  className="w-full h-full relative overflow-hidden bg-stone-900"
                >
                  <EditorialPhotoIllustration
                    articleId={item.mod.articleId}
                    category={item.mod.sectionCategory}
                    imageUrl={item.mod.photographUrl}
                    altText={item.titleTelugu}
                    locationTelugu={item.mod.locationDatelineTelugu}
                    heightClass="h-full"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-black/80 py-1 px-1.5">
                    <span className="font-telugu-sans text-[10px] font-extrabold text-amber-300 block leading-tight">
                      {item.statTelugu}
                    </span>
                  </div>
                </div>

                {spec.svg_border_path && (
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute inset-0 w-full h-full z-10"
                  >
                    <path
                      d={spec.svg_border_path}
                      fill="none"
                      stroke={item.accentHex}
                      strokeWidth="3.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                )}
              </div>

              {/* Positioned Telugu Headline Below / Around Shape */}
              <div className="mt-1.5">
                <h4
                  style={{ color: item.accentHex }}
                  className="font-telugu-sans text-[12.5px] font-extrabold leading-[1.3] group-hover:underline"
                >
                  {item.titleTelugu}
                </h4>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
