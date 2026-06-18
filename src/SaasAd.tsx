import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {COLORS, FPS, SCENES} from './theme';
import {fontFamily} from './font';
import {IndicatorIcons} from './components/IndicatorIcons';
import {GlitchText} from './components/GlitchText';

// ---------- shared helpers ----------

const FullText: React.FC<{
  children: React.ReactNode;
  bg?: string;
  style?: React.CSSProperties;
}> = ({children, bg = COLORS.bg, style}) => (
  <AbsoluteFill
    style={{
      backgroundColor: bg,
      justifyContent: 'center',
      alignItems: 'center',
      padding: '0 90px',
      ...style,
    }}
  >
    {children}
  </AbsoluteFill>
);

// Fade in over `inDur` frames, fade out over the last `outDur` frames.
const useSceneFade = (inDur = 14, outDur = 12) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  return (
    interpolate(frame, [0, inDur], [0, 1], {extrapolateRight: 'clamp'}) *
    interpolate(
      frame,
      [durationInFrames - outDur, durationInFrames],
      [1, 0],
      {extrapolateLeft: 'clamp'}
    )
  );
};

const headingStyle: React.CSSProperties = {
  fontFamily,
  fontWeight: 900,
  color: COLORS.ink,
  textAlign: 'center',
  letterSpacing: '-0.03em',
  lineHeight: 1.02,
  margin: 0,
};

// ---------- scene components ----------

const SceneCharts: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = useSceneFade(18, 12);
  const rise = spring({frame, fps, config: {damping: 16, mass: 0.8}});
  return (
    <FullText>
      <h1
        style={{
          ...headingStyle,
          fontSize: 150,
          letterSpacing: '0.02em',
          opacity,
          transform: `translateY(${interpolate(rise, [0, 1], [40, 0])}px)`,
        }}
      >
        TRADING
      </h1>
    </FullText>
  );
};

const SceneMessy: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = useSceneFade(12, 12);
  // "messy" pops in a bit after the line appears.
  const pop = spring({
    frame: frame - 10,
    fps,
    config: {damping: 9, mass: 0.6, stiffness: 140},
  });
  const popScale = interpolate(pop, [0, 1], [0.4, 1.18]);
  const settle = spring({frame: frame - 22, fps, config: {damping: 14}});
  const finalScale = interpolate(settle, [0, 1], [popScale, 1.06]);
  const wiggle = Math.sin((frame - 10) * 0.5) * interpolate(frame, [10, 40], [4, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <FullText>
      <div style={{opacity, textAlign: 'center'}}>
        <div style={{...headingStyle, fontSize: 120}}>shouldn&rsquo;t be</div>
        <div
          style={{
            ...headingStyle,
            fontSize: 200,
            color: COLORS.red,
            display: 'inline-block',
            transform: `scale(${frame < 10 ? 0 : finalScale}) rotate(${wiggle}deg)`,
            marginTop: 10,
          }}
        >
          messy
        </div>
      </div>
    </FullText>
  );
};

const SceneIndicators: React.FC = () => {
  const opacity = useSceneFade(12, 12);
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const rise = spring({frame, fps, config: {damping: 16}});
  // slow zoom on the busy chart so it feels alive behind the text
  const kenBurns = interpolate(frame, [0, durationInFrames], [1.18, 1.32]);
  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bg, overflow: 'hidden'}}>
      {/* busy real chart background */}
      <AbsoluteFill style={{opacity}}>
        <Img
          src={staticFile('img/messy-chart.jpg')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${kenBurns})`,
          }}
        />
      </AbsoluteFill>

      {/* light wash so the chart still reads as a "messy" busy screen */}
      <AbsoluteFill
        style={{
          opacity,
          background:
            'linear-gradient(to bottom, rgba(245,245,245,0.35) 0%, rgba(245,245,245,0.15) 40%, rgba(245,245,245,0.15) 60%, rgba(245,245,245,0.45) 100%)',
        }}
      />

      {/* floating indicator chips */}
      <IndicatorIcons />

      {/* heading on a frosted panel for legibility */}
      <AbsoluteFill
        style={{justifyContent: 'center', alignItems: 'center', padding: '0 70px'}}
      >
        <div
          style={{
            opacity,
            transform: `translateY(${interpolate(rise, [0, 1], [30, 0])}px)`,
            background: 'rgba(255,255,255,0.86)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            padding: '44px 56px',
            borderRadius: 36,
            boxShadow: '0 30px 80px rgba(0,0,0,0.18)',
            zIndex: 5,
          }}
        >
          <h1 style={{...headingStyle, fontSize: 100}}>
            Too many
            <br />
            indicators
          </h1>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const SceneFakeSignals: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const opacity = useSceneFade(8, 8);
  const kenBurns = interpolate(frame, [0, durationInFrames], [1.12, 1.24]);
  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bgDark, overflow: 'hidden'}}>
      <AbsoluteFill style={{opacity}}>
        <Img
          src={staticFile('img/fake-signals.jpg')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${kenBurns})`,
          }}
        />
      </AbsoluteFill>
      {/* dark scrim so the glitch text pops */}
      <AbsoluteFill style={{backgroundColor: 'rgba(8,8,8,0.62)', opacity}} />
      <AbsoluteFill
        style={{justifyContent: 'center', alignItems: 'center', padding: '0 70px'}}
      >
        <GlitchText text="Too many fake signals" fontSize={120} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const SceneIdentify: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const opacity = useSceneFade(12, 12);
  const rise = spring({frame, fps, config: {damping: 16, mass: 0.8}});
  const kenBurns = interpolate(frame, [0, durationInFrames], [1.12, 1.24]);
  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bgDark, overflow: 'hidden'}}>
      <AbsoluteFill style={{opacity}}>
        <Img
          src={staticFile('img/fake-signals.jpg')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${kenBurns})`,
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{backgroundColor: 'rgba(8,8,8,0.55)', opacity}} />
      <AbsoluteFill
        style={{justifyContent: 'center', alignItems: 'center', padding: '0 70px'}}
      >
        <h1
          style={{
            ...headingStyle,
            color: '#FFFFFF',
            fontSize: 110,
            opacity,
            transform: `translateY(${interpolate(rise, [0, 1], [36, 0])}px)`,
            textShadow: '0 10px 40px rgba(0,0,0,0.6)',
          }}
        >
          Can't identify
          <br />
          the move
        </h1>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const SceneBrand: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = useSceneFade(14, 14);
  const pop = spring({frame, fps, config: {damping: 12, mass: 0.9, stiffness: 110}});
  const scale = interpolate(pop, [0, 1], [0.6, 1]);
  const glow = interpolate(
    Math.sin(frame * 0.12),
    [-1, 1],
    [0.25, 0.55]
  );
  return (
    <FullText>
      <div style={{opacity, textAlign: 'center', transform: `scale(${scale})`}}>
        <div
          style={{
            ...headingStyle,
            fontSize: 150,
            color: COLORS.brand,
            textShadow: `0 30px 80px rgba(16,185,129,${glow})`,
          }}
        >
          TUX S&amp;D
        </div>
        <div
          style={{
            ...headingStyle,
            fontSize: 110,
            color: COLORS.ink,
            letterSpacing: '0.12em',
            marginTop: 6,
          }}
        >
          KINETIC
        </div>
      </div>
    </FullText>
  );
};

// A short statement over a real screenshot background (frosted panel for text).
const ImageStatement: React.FC<{
  image: string;
  lines: string[];
  highlightLast?: boolean;
}> = ({image, lines, highlightLast}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const opacity = useSceneFade(12, 12);
  const rise = spring({frame, fps, config: {damping: 16, mass: 0.8}});
  const kenBurns = interpolate(frame, [0, durationInFrames], [1.1, 1.22]);
  const pop = spring({frame: frame - 16, fps, config: {damping: 10, stiffness: 130}});

  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bg, overflow: 'hidden'}}>
      <AbsoluteFill style={{opacity}}>
        <Img
          src={staticFile(image)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${kenBurns})`,
          }}
        />
      </AbsoluteFill>
      {/* light wash to keep the minimalist look */}
      <AbsoluteFill
        style={{
          opacity,
          background:
            'linear-gradient(to bottom, rgba(245,245,245,0.30) 0%, rgba(245,245,245,0.10) 40%, rgba(245,245,245,0.10) 60%, rgba(245,245,245,0.40) 100%)',
        }}
      />
      <AbsoluteFill
        style={{justifyContent: 'center', alignItems: 'center', padding: '0 70px'}}
      >
        <div
          style={{
            opacity,
            transform: `translateY(${interpolate(rise, [0, 1], [30, 0])}px)`,
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            padding: '44px 56px',
            borderRadius: 36,
            boxShadow: '0 30px 80px rgba(0,0,0,0.2)',
          }}
        >
          <h1 style={{...headingStyle, fontSize: 100}}>
            {lines.map((l, i) => {
              const isLast = i === lines.length - 1;
              return (
                <React.Fragment key={i}>
                  {highlightLast && isLast ? (
                    <span
                      style={{
                        color: COLORS.brand,
                        display: 'inline-block',
                        transform: `scale(${interpolate(pop, [0, 1], [0.7, 1])})`,
                      }}
                    >
                      {l}
                    </span>
                  ) : (
                    l
                  )}
                  {!isLast ? <br /> : null}
                </React.Fragment>
              );
            })}
          </h1>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Pill-shaped feature callout that pops in over the moving chart clip.
const FeaturePill: React.FC<{
  label: string;
  delay: number;
  top: string;
  align: 'left' | 'right';
}> = ({label, delay, top, align}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({
    frame: frame - delay,
    fps,
    config: {damping: 11, mass: 0.7, stiffness: 130},
  });
  if (frame < delay) return null;
  const float = Math.sin((frame - delay) / 12) * 5;
  return (
    <div
      style={{
        position: 'absolute',
        top,
        [align]: 56,
        transform: `scale(${pop}) translateY(${float}px)`,
        opacity: pop,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '20px 30px',
        background: '#FFFFFF',
        borderRadius: 999,
        boxShadow: '0 18px 50px rgba(0,0,0,0.28)',
        maxWidth: 620,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 38,
          height: 38,
          borderRadius: 999,
          background: COLORS.brand,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path
            d="M5 13l4 4L19 7"
            fill="none"
            stroke="#fff"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span
        style={{
          fontFamily,
          fontWeight: 800,
          fontSize: 40,
          letterSpacing: '-0.01em',
          color: COLORS.ink,
        }}
      >
        {label}
      </span>
    </div>
  );
};

const FEATURES: {label: string; top: string; align: 'left' | 'right'}[] = [
  {label: 'High-probability reversal zones', top: '14%', align: 'left'},
  {label: 'Breakout zones', top: '30%', align: 'right'},
  {label: 'Confirmation dashboard', top: '46%', align: 'left'},
  {label: 'Trend filters', top: '62%', align: 'right'},
  {label: 'Trail stops', top: '78%', align: 'left'},
];

// Real screen-recording background with feature pills popping in over it.
const SceneFeatures: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = useSceneFade(14, 14);
  const headerRise = spring({frame, fps, config: {damping: 16}});
  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bgDark, overflow: 'hidden'}}>
      <AbsoluteFill style={{opacity}}>
        <OffthreadVideo
          src={staticFile('img/dashboard-clip.mp4')}
          muted
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
      </AbsoluteFill>
      {/* subtle scrim so the white pills read against the chart */}
      <AbsoluteFill style={{backgroundColor: 'rgba(8,10,14,0.22)', opacity}} />

      {/* header pill */}
      <div
        style={{
          position: 'absolute',
          top: '4.5%',
          left: '50%',
          transform: `translateX(-50%) translateY(${interpolate(headerRise, [0, 1], [-24, 0])}px)`,
          opacity,
          padding: '16px 34px',
          background: COLORS.ink,
          color: '#fff',
          borderRadius: 999,
          fontFamily,
          fontWeight: 800,
          fontSize: 38,
          letterSpacing: '0.01em',
          boxShadow: '0 18px 50px rgba(0,0,0,0.35)',
        }}
      >
        This indicator helps you
      </div>

      <AbsoluteFill style={{opacity}}>
        {FEATURES.map((f, i) => (
          <FeaturePill
            key={f.label}
            label={f.label}
            delay={14 + i * 40}
            top={f.top}
            align={f.align}
          />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const InstagramIcon: React.FC<{size?: number; color?: string}> = ({
  size = 46,
  color = '#fff',
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke={color} strokeWidth="2" />
    <circle cx="12" cy="12" r="4.2" stroke={color} strokeWidth="2" />
    <circle cx="17.4" cy="6.6" r="1.3" fill={color} />
  </svg>
);

const GlobeIcon: React.FC<{size?: number; color?: string}> = ({
  size = 42,
  color = COLORS.brand,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9.2" stroke={color} strokeWidth="2" />
    <ellipse cx="12" cy="12" rx="4" ry="9.2" stroke={color} strokeWidth="2" />
    <line x1="3" y1="12" x2="21" y2="12" stroke={color} strokeWidth="2" />
  </svg>
);

const SceneEndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = useSceneFade(14, 6);
  const brandPop = spring({frame, fps, config: {damping: 12, mass: 0.9}});
  const tagRise = spring({frame: frame - 10, fps, config: {damping: 16}});
  const igPop = spring({frame: frame - 22, fps, config: {damping: 11, stiffness: 130}});
  const webRise = spring({frame: frame - 36, fps, config: {damping: 16}});
  return (
    <FullText>
      <div style={{opacity, textAlign: 'center'}}>
        <div
          style={{
            ...headingStyle,
            fontSize: 112,
            color: COLORS.brand,
            transform: `scale(${interpolate(brandPop, [0, 1], [0.7, 1])})`,
          }}
        >
          TUX S&amp;D
        </div>
        <div
          style={{
            ...headingStyle,
            fontSize: 80,
            letterSpacing: '0.12em',
            color: COLORS.ink,
          }}
        >
          KINETIC
        </div>
        <div
          style={{
            fontFamily,
            fontWeight: 600,
            fontSize: 44,
            color: COLORS.inkSoft,
            marginTop: 26,
            transform: `translateY(${interpolate(tagRise, [0, 1], [24, 0])}px)`,
            opacity: tagRise,
          }}
        >
          Your trades, organized
        </div>

        {/* Instagram CTA */}
        <div
          style={{
            marginTop: 52,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 22,
            padding: '26px 48px',
            background:
              'linear-gradient(95deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)',
            color: '#FFFFFF',
            borderRadius: 999,
            boxShadow: '0 24px 60px rgba(221,42,123,0.4)',
            transform: `scale(${interpolate(igPop, [0, 1], [0.5, 1])})`,
            opacity: igPop,
          }}
        >
          <InstagramIcon />
          <div style={{textAlign: 'left'}}>
            <div style={{fontFamily, fontWeight: 800, fontSize: 50, lineHeight: 1.05}}>
              @tuxtradingalgo_
            </div>
            <div style={{fontFamily, fontWeight: 600, fontSize: 32, opacity: 0.95}}>
              DM for a free 3-day trial
            </div>
          </div>
        </div>

        {/* Website */}
        <div
          style={{
            marginTop: 34,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            transform: `translateY(${interpolate(webRise, [0, 1], [24, 0])}px)`,
            opacity: webRise,
          }}
        >
          <div style={{display: 'inline-flex', alignItems: 'center', gap: 16}}>
            <GlobeIcon />
            <span style={{fontFamily, fontWeight: 800, fontSize: 50, color: COLORS.ink}}>
              Tuxtradingalgo.com
            </span>
          </div>
          <span style={{fontFamily, fontWeight: 600, fontSize: 32, color: COLORS.inkSoft}}>
            Visit for more information
          </span>
        </div>
      </div>
    </FullText>
  );
};

// ---------- master timeline ----------

export const SaasAd: React.FC = () => {
  const s = SCENES;
  const dur = (sec: number) => sec * FPS;
  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bg}}>
      <Sequence from={s.charts.from} durationInFrames={dur(s.charts.durationInSeconds)}>
        <SceneCharts />
      </Sequence>

      <Sequence from={s.messy.from} durationInFrames={dur(s.messy.durationInSeconds)}>
        <SceneMessy />
      </Sequence>

      <Sequence from={s.indicators.from} durationInFrames={dur(s.indicators.durationInSeconds)}>
        <SceneIndicators />
      </Sequence>

      <Sequence from={s.fakeSignals.from} durationInFrames={dur(s.fakeSignals.durationInSeconds)}>
        <SceneFakeSignals />
      </Sequence>

      <Sequence from={s.identify.from} durationInFrames={dur(s.identify.durationInSeconds)}>
        <SceneIdentify />
      </Sequence>

      <Sequence from={s.easy.from} durationInFrames={dur(s.easy.durationInSeconds)}>
        <ImageStatement image="img/good-chart.jpg" lines={['Trading should', 'be easy']} />
      </Sequence>

      <Sequence from={s.money.from} durationInFrames={dur(s.money.durationInSeconds)}>
        <ImageStatement
          image="img/profit.jpg"
          lines={['It should help you', 'make money']}
          highlightLast
        />
      </Sequence>

      <Sequence from={s.brand.from} durationInFrames={dur(s.brand.durationInSeconds)}>
        <SceneBrand />
      </Sequence>

      {/* feature showcase over the real screen-recording (replaces the two
          old structure/setups scenes; spans 17s-25s) */}
      <Sequence
        from={s.structure.from}
        durationInFrames={
          dur(s.structure.durationInSeconds) + dur(s.setups.durationInSeconds)
        }
      >
        <SceneFeatures />
      </Sequence>

      <Sequence from={s.endCard.from} durationInFrames={dur(s.endCard.durationInSeconds)}>
        <SceneEndCard />
      </Sequence>
    </AbsoluteFill>
  );
};
