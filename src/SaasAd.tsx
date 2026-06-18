import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
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
import {MockChart} from './components/MockChart';

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

const SceneSimpleLine: React.FC<{lines: string[]; fontSize?: number}> = ({
  lines,
  fontSize = 110,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = useSceneFade(12, 12);
  const rise = spring({frame, fps, config: {damping: 16, mass: 0.8}});
  return (
    <FullText>
      <h1
        style={{
          ...headingStyle,
          fontSize,
          opacity,
          transform: `translateY(${interpolate(rise, [0, 1], [36, 0])}px)`,
        }}
      >
        {lines.map((l, i) => (
          <React.Fragment key={i}>
            {l}
            {i < lines.length - 1 ? <br /> : null}
          </React.Fragment>
        ))}
      </h1>
    </FullText>
  );
};

const SceneMoney: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = useSceneFade(12, 12);
  const rise = spring({frame, fps, config: {damping: 16}});
  const moneyPop = spring({frame: frame - 18, fps, config: {damping: 10, stiffness: 130}});
  return (
    <FullText>
      <h1
        style={{
          ...headingStyle,
          fontSize: 104,
          opacity,
          transform: `translateY(${interpolate(rise, [0, 1], [36, 0])}px)`,
        }}
      >
        It should help you
        <br />
        <span
          style={{
            color: COLORS.brand,
            display: 'inline-block',
            transform: `scale(${interpolate(moneyPop, [0, 1], [0.7, 1])})`,
          }}
        >
          make money
        </span>
      </h1>
    </FullText>
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

// Scenes that show an "app screenshot" (mock chart) with overlay text.
const SceneScreenshot: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  demandZone?: [number, number];
  supplyZone?: [number, number];
  highlightSetups?: boolean;
}> = ({title, subtitle, demandZone, supplyZone, highlightSetups}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const opacity = useSceneFade(14, 14);
  const reveal = interpolate(frame, [6, 55], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const kenBurns = interpolate(frame, [0, durationInFrames], [1.06, 1.12]);
  const textRise = spring({frame: frame - 12, fps, config: {damping: 16}});

  return (
    <AbsoluteFill style={{backgroundColor: COLORS.bg, overflow: 'hidden'}}>
      {/* mock app screenshot background */}
      <AbsoluteFill
        style={{
          transform: `scale(${kenBurns})`,
          opacity: opacity * 0.95,
          padding: '120px 60px',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            background: '#FFFFFF',
            borderRadius: 40,
            boxShadow: '0 40px 120px rgba(0,0,0,0.12)',
            padding: 40,
            overflow: 'hidden',
          }}
        >
          <MockChart
            reveal={reveal}
            demandZone={demandZone}
            supplyZone={supplyZone}
            highlightSetups={highlightSetups}
          />
        </div>
      </AbsoluteFill>

      {/* gradient scrim for legibility */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(to bottom, rgba(245,245,245,0.95) 0%, rgba(245,245,245,0) 26%, rgba(245,245,245,0) 64%, rgba(245,245,245,0.97) 100%)',
        }}
      />

      {/* overlay text */}
      <AbsoluteFill
        style={{
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '150px 70px',
          opacity,
        }}
      >
        <h1
          style={{
            ...headingStyle,
            fontSize: 86,
            transform: `translateY(${interpolate(textRise, [0, 1], [-24, 0])}px)`,
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <div
            style={{
              fontFamily,
              fontWeight: 700,
              fontSize: 58,
              color: COLORS.brandDark,
              textAlign: 'center',
              lineHeight: 1.2,
              transform: `translateY(${interpolate(textRise, [0, 1], [24, 0])}px)`,
            }}
          >
            {subtitle}
          </div>
        ) : (
          <span />
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const SceneEndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = useSceneFade(14, 6);
  const brandPop = spring({frame, fps, config: {damping: 12, mass: 0.9}});
  const tagRise = spring({frame: frame - 12, fps, config: {damping: 16}});
  const ctaPop = spring({frame: frame - 26, fps, config: {damping: 9, stiffness: 130}});
  return (
    <FullText>
      <div style={{opacity, textAlign: 'center'}}>
        <div
          style={{
            ...headingStyle,
            fontSize: 128,
            color: COLORS.brand,
            transform: `scale(${interpolate(brandPop, [0, 1], [0.7, 1])})`,
          }}
        >
          TUX S&amp;D
        </div>
        <div
          style={{
            ...headingStyle,
            fontSize: 92,
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
            fontSize: 52,
            color: COLORS.inkSoft,
            marginTop: 36,
            transform: `translateY(${interpolate(tagRise, [0, 1], [24, 0])}px)`,
            opacity: tagRise,
          }}
        >
          Your trades, organized
        </div>
        <div
          style={{
            display: 'inline-block',
            marginTop: 56,
            padding: '30px 64px',
            background: COLORS.brand,
            color: '#FFFFFF',
            fontFamily,
            fontWeight: 800,
            fontSize: 58,
            borderRadius: 999,
            boxShadow: '0 24px 60px rgba(16,185,129,0.4)',
            transform: `scale(${interpolate(ctaPop, [0, 1], [0.5, 1])})`,
          }}
        >
          Start your 3-Day Trial
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
        <SceneSimpleLine lines={['Trading should', 'be easy']} />
      </Sequence>

      <Sequence from={s.money.from} durationInFrames={dur(s.money.durationInSeconds)}>
        <SceneMoney />
      </Sequence>

      <Sequence from={s.brand.from} durationInFrames={dur(s.brand.durationInSeconds)}>
        <SceneBrand />
      </Sequence>

      <Sequence from={s.structure.from} durationInFrames={dur(s.structure.durationInSeconds)}>
        <SceneScreenshot
          title="Identifies true market structure"
          demandZone={[26, 34]}
          supplyZone={[64, 72]}
        />
      </Sequence>

      <Sequence from={s.setups.from} durationInFrames={dur(s.setups.durationInSeconds)}>
        <SceneScreenshot
          title="High probability setups"
          subtitle="Only real zones"
          demandZone={[30, 38]}
          highlightSetups
        />
      </Sequence>

      <Sequence from={s.endCard.from} durationInFrames={dur(s.endCard.durationInSeconds)}>
        <SceneEndCard />
      </Sequence>
    </AbsoluteFill>
  );
};
