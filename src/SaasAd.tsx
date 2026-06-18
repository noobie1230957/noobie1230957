import React from 'react';
import {
  AbsoluteFill,
  Audio,
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

// ---------- ClickUp-style attention helpers ----------

// Soft radial color glow behind hero words (the signature ClickUp look).
const Glow: React.FC<{color: string; size?: number; intensity?: number}> = ({
  color,
  size = 900,
  intensity = 0.5,
}) => {
  const frame = useCurrentFrame();
  const pulse = interpolate(Math.sin(frame * 0.12), [-1, 1], [0.82, 1.05]);
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: size,
        height: size,
        transform: `translate(-50%, -50%) scale(${pulse})`,
        background: `radial-gradient(circle, ${color} 0%, rgba(255,255,255,0) 62%)`,
        opacity: intensity,
        filter: 'blur(20px)',
        pointerEvents: 'none',
      }}
    />
  );
};

// Snappy "motion-blur" entrance: returns scale + blur for a word popping in.
const usePunchIn = (delay = 0) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: {damping: 13, mass: 0.6, stiffness: 150},
  });
  const blur = interpolate(s, [0, 1], [16, 0]);
  const scale = interpolate(s, [0, 1], [0.6, 1]);
  return {scale, blur, progress: s};
};

// Editor cursor pointer, like the ClickUp ad.
const Cursor: React.FC<{x: number; y: number; delay?: number}> = ({x, y, delay = 6}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - delay, fps, config: {damping: 14}});
  const bob = Math.sin(frame * 0.18) * 4;
  return (
    <svg
      width="58"
      height="58"
      viewBox="0 0 24 24"
      style={{
        position: 'absolute',
        left: x,
        top: y + bob,
        opacity: s,
        transform: `scale(${s})`,
        filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.25))',
      }}
    >
      <path d="M5 3l14 8-6 1.5L9.5 18 5 3z" fill="#fff" stroke={COLORS.ink} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
};

// Selection box with corner handles around a word (ClickUp "sense" motif).
const SelectionHandles: React.FC<{color?: string; delay?: number}> = ({
  color = COLORS.brand,
  delay = 8,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - delay, fps, config: {damping: 16}});
  const dot = (style: React.CSSProperties) => (
    <div
      style={{
        position: 'absolute',
        width: 26,
        height: 26,
        borderRadius: 999,
        background: color,
        border: '4px solid #fff',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        ...style,
      }}
    />
  );
  return (
    <div style={{position: 'absolute', inset: -22, opacity: s, borderRadius: 14, border: `3px solid ${color}`}}>
      {dot({top: -13, left: -13})}
      {dot({bottom: -13, right: -13})}
    </div>
  );
};

// Floating emoji accents (like the emojis around "Messy").
const FloatingEmojis: React.FC<{emojis: {char: string; x: string; y: string; delay: number}[]}> = ({
  emojis,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <>
      {emojis.map((e, i) => {
        const s = spring({frame: frame - e.delay, fps, config: {damping: 9, mass: 0.6, stiffness: 130}});
        const float = Math.sin((frame + i * 20) * 0.12) * 10;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: e.x,
              top: e.y,
              fontSize: 64,
              transform: `translate(-50%, -50%) scale(${s}) translateY(${float}px)`,
              opacity: s,
            }}
          >
            {e.char}
          </div>
        );
      })}
    </>
  );
};

// ---------- scene components ----------

const SceneCharts: React.FC = () => {
  const opacity = useSceneFade(10, 12);
  const {scale, blur} = usePunchIn(2);
  return (
    <FullText>
      <Glow color="rgba(16,185,129,0.45)" size={1000} intensity={0.55} />
      <h1
        style={{
          ...headingStyle,
          fontSize: 150,
          letterSpacing: '0.02em',
          opacity,
          position: 'relative',
          transform: `scale(${scale})`,
          filter: `blur(${blur}px)`,
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
  const opacity = useSceneFade(10, 12);
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
      <Glow color="rgba(239,68,68,0.4)" size={900} intensity={0.5} />
      <FloatingEmojis
        emojis={[
          {char: '😵‍💫', x: '30%', y: '40%', delay: 12},
          {char: '🤔', x: '72%', y: '44%', delay: 18},
          {char: '😣', x: '42%', y: '62%', delay: 24},
        ]}
      />
      <div style={{opacity, textAlign: 'center', position: 'relative'}}>
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
      <Cursor x={640} y={1060} delay={20} />
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
      <Glow color="rgba(16,185,129,0.5)" size={1100} intensity={0.6} />
      <div style={{opacity, textAlign: 'center', transform: `scale(${scale})`, position: 'relative'}}>
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
                        position: 'relative',
                        transform: `scale(${interpolate(pop, [0, 1], [0.7, 1])})`,
                      }}
                    >
                      {l}
                      <SelectionHandles delay={18} />
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

// ---- small inline icons ----
const Dot: React.FC<{color: string}> = ({color}) => (
  <span style={{flexShrink: 0, width: 18, height: 18, borderRadius: 999, background: color}} />
);
const Arrow: React.FC<{dir: 'up' | 'down'}> = ({dir}) => (
  <svg width="34" height="34" viewBox="0 0 24 24" style={{flexShrink: 0}}>
    <path
      d={dir === 'down' ? 'M12 4v14M6 12l6 6 6-6' : 'M12 20V6M6 12l6-6 6 6'}
      fill="none"
      stroke="#fff"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

type PillVariant = 'white' | 'dark' | 'red' | 'green';
const VARIANT: Record<PillVariant, {bg: string; fg: string; shadow: string}> = {
  white: {bg: '#FFFFFF', fg: COLORS.ink, shadow: '0 18px 50px rgba(0,0,0,0.30)'},
  dark: {bg: COLORS.ink, fg: '#fff', shadow: '0 18px 50px rgba(0,0,0,0.45)'},
  red: {bg: COLORS.red, fg: '#fff', shadow: '0 18px 50px rgba(239,68,68,0.45)'},
  green: {bg: COLORS.brand, fg: '#fff', shadow: '0 18px 50px rgba(16,185,129,0.45)'},
};

// A centered, timed pill that pops in and (optionally) out.
const Pill: React.FC<{
  children: React.ReactNode;
  top: string;
  appear: number;
  disappear?: number;
  variant?: PillVariant;
  fontSize?: number;
  icon?: React.ReactNode;
}> = ({children, top, appear, disappear, variant = 'white', fontSize = 44, icon}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (frame < appear) return null;
  if (disappear !== undefined && frame > disappear + 10) return null;
  const inS = spring({frame: frame - appear, fps, config: {damping: 12, mass: 0.7, stiffness: 130}});
  const out =
    disappear !== undefined
      ? interpolate(frame, [disappear, disappear + 10], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;
  const float = Math.sin((frame - appear) / 14) * 4;
  const v = VARIANT[variant];
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: '50%',
        transform: `translateX(-50%) scale(${inS}) translateY(${float}px)`,
        opacity: inS * out,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '24px 40px',
        background: v.bg,
        color: v.fg,
        borderRadius: 999,
        boxShadow: v.shadow,
        maxWidth: 900,
        width: 'max-content',
      }}
    >
      {icon}
      <span style={{fontFamily, fontWeight: 800, fontSize, letterSpacing: '-0.01em', textAlign: 'left'}}>
        {children}
      </span>
    </div>
  );
};

const hi = (text: string, color: string): React.ReactNode => (
  <span style={{color}}>{text}</span>
);

// "How it works" — the real clip plays while the logic is told in pills.
const SceneHowItWorks: React.FC = () => {
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
      <AbsoluteFill style={{backgroundColor: 'rgba(8,10,14,0.32)', opacity}} />

      {/* header */}
      <div
        style={{
          position: 'absolute',
          top: '4.5%',
          left: '50%',
          transform: `translateX(-50%) translateY(${interpolate(headerRise, [0, 1], [-24, 0])}px)`,
          opacity,
          padding: '18px 44px',
          background: COLORS.brand,
          color: '#fff',
          borderRadius: 999,
          fontFamily,
          fontWeight: 900,
          fontSize: 48,
          letterSpacing: '-0.01em',
          boxShadow: '0 18px 50px rgba(16,185,129,0.4)',
        }}
      >
        How it works
      </div>

      <AbsoluteFill style={{opacity}}>
        {/* Flow 1 — SHORT power level -> dump */}
        <Pill top="24%" appear={8} disappear={116} variant="dark" icon={<Dot color={COLORS.red} />}>
          Price taps a {hi('SHORT', '#FF6B6B')} power level
        </Pill>
        <Pill top="41%" appear={34} disappear={116} variant="white">
          Dashboard confirms {hi('RSI above 55', COLORS.red)}
        </Pill>
        <Pill top="58%" appear={62} disappear={116} variant="red" fontSize={56} icon={<Arrow dir="down" />}>
          Market dumps
        </Pill>

        {/* Flow 2 — LONG power level -> pump */}
        <Pill top="24%" appear={130} disappear={250} variant="dark" icon={<Dot color={COLORS.brand} />}>
          Price taps a {hi('LONG', '#4ADE80')} power level
        </Pill>
        <Pill top="41%" appear={156} disappear={250} variant="white">
          Dashboard confirms {hi('RSI below 49', COLORS.brandDark)}
        </Pill>
        <Pill top="58%" appear={184} disappear={250} variant="green" fontSize={56} icon={<Arrow dir="up" />}>
          Market pumps
        </Pill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// "Get access + 4 extra indicators" — montage of real screenshots.
const ACCESS_SHOTS = [
  'img/gbpjpy-bands.jpg',
  'img/gbpjpy-trend.jpg',
  'img/settings.jpg',
  'img/btc-profit.jpg',
];
const SceneAccess: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = useSceneFade(14, 14);
  const titleRise = spring({frame, fps, config: {damping: 16}});
  return (
    <FullText>
      <div style={{opacity, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <h1
          style={{
            ...headingStyle,
            fontSize: 100,
            transform: `translateY(${interpolate(titleRise, [0, 1], [-24, 0])}px)`,
          }}
        >
          Get access
        </h1>
        <div
          style={{
            fontFamily,
            fontWeight: 800,
            fontSize: 54,
            color: COLORS.brand,
            marginTop: 10,
            marginBottom: 48,
          }}
        >
          + 4 extra indicators
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 28,
            width: '100%',
            padding: '0 14px',
          }}
        >
          {ACCESS_SHOTS.map((src, i) => {
            const pop = spring({frame: frame - (10 + i * 9), fps, config: {damping: 13, stiffness: 120}});
            return (
              <div
                key={src}
                style={{
                  transform: `scale(${pop})`,
                  opacity: pop,
                  height: 560,
                  borderRadius: 28,
                  overflow: 'hidden',
                  boxShadow: '0 30px 70px rgba(0,0,0,0.2)',
                  background: '#fff',
                }}
              >
                <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
              </div>
            );
          })}
        </div>
      </div>
    </FullText>
  );
};

// ---- benefits icons ----
const WhatsAppIcon: React.FC = () => (
  <svg width="50" height="50" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Z"
      fill="#25D366"
    />
    <path
      d="M8.5 7.3c-.2-.5-.4-.5-.7-.5h-.5c-.2 0-.5.1-.7.3-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.9 4.5 3.9 2.2.9 2.7.7 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.5-.3l-1.6-.8c-.2-.1-.4-.1-.6.1l-.6.8c-.1.2-.3.2-.5.1-.3-.1-1.1-.4-2-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5 0-.2 0-.3 0-.5l-.7-1.8Z"
      fill="#fff"
    />
  </svg>
);
const UpgradeIcon: React.FC = () => (
  <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
    <path d="M12 3l3.5 5.5L21 10l-4.5 4 1 6L12 17l-5.5 3 1-6L3 10l5.5-1.5L12 3Z" fill={COLORS.brand} />
  </svg>
);
const CommunityIcon: React.FC = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
    <circle cx="8" cy="9" r="3" fill={COLORS.brand} />
    <circle cx="16.5" cy="10" r="2.5" fill={COLORS.brandDark} />
    <path d="M2.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" fill={COLORS.brand} />
    <path d="M14 19c0-2.4 1.6-4 3.5-4s3.9 1.4 4 4" fill={COLORS.brandDark} />
  </svg>
);

const BenefitPill: React.FC<{
  appear: number;
  icon: React.ReactNode;
  title: string;
  sub: string;
}> = ({appear, icon, title, sub}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (frame < appear) return null;
  const pop = spring({frame: frame - appear, fps, config: {damping: 12, mass: 0.7, stiffness: 120}});
  return (
    <div
      style={{
        transform: `scale(${pop})`,
        opacity: pop,
        display: 'flex',
        alignItems: 'center',
        gap: 28,
        width: '92%',
        padding: '30px 40px',
        background: '#fff',
        borderRadius: 44,
        boxShadow: '0 24px 60px rgba(0,0,0,0.12)',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 96,
          height: 96,
          borderRadius: 26,
          background: 'rgba(16,185,129,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <div style={{textAlign: 'left'}}>
        <div style={{fontFamily, fontWeight: 900, fontSize: 54, color: COLORS.ink, lineHeight: 1.05}}>
          {title}
        </div>
        <div style={{fontFamily, fontWeight: 600, fontSize: 34, color: COLORS.inkSoft, marginTop: 6}}>
          {sub}
        </div>
      </div>
    </div>
  );
};

// "Get the code, you also get" — community / upgrades / WhatsApp benefits.
const SceneBenefits: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = useSceneFade(14, 14);
  const titleRise = spring({frame, fps, config: {damping: 16}});
  return (
    <FullText>
      <div
        style={{
          opacity,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 34,
        }}
      >
        <h1
          style={{
            ...headingStyle,
            fontSize: 82,
            marginBottom: 6,
            transform: `translateY(${interpolate(titleRise, [0, 1], [-24, 0])}px)`,
          }}
        >
          Get the code,
          <br />
          you also get
        </h1>
        <BenefitPill
          appear={20}
          icon={<WhatsAppIcon />}
          title="WhatsApp group"
          sub="Daily market breakdowns posted"
        />
        <BenefitPill
          appear={46}
          icon={<UpgradeIcon />}
          title="Free future upgrades"
          sub="Every new indicator update, free"
        />
        <BenefitPill
          appear={72}
          icon={<CommunityIcon />}
          title="A trading community"
          sub="Talk & learn with fellow traders"
        />
      </div>
    </FullText>
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
      <Audio src={staticFile('audio/track.m4a')} volume={0.9} />

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

      <Sequence from={s.howItWorks.from} durationInFrames={dur(s.howItWorks.durationInSeconds)}>
        <SceneHowItWorks />
      </Sequence>

      <Sequence from={s.access.from} durationInFrames={dur(s.access.durationInSeconds)}>
        <SceneAccess />
      </Sequence>

      <Sequence from={s.benefits.from} durationInFrames={dur(s.benefits.durationInSeconds)}>
        <SceneBenefits />
      </Sequence>

      <Sequence from={s.endCard.from} durationInFrames={dur(s.endCard.durationInSeconds)}>
        <SceneEndCard />
      </Sequence>
    </AbsoluteFill>
  );
};
