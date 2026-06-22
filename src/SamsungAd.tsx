import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {fontFamily} from './font';

// One UI / Samsung palette
const C = {
  light: '#F1F2F4',
  dark: '#0A0A0C',
  ink: '#0B0B0D',
  card: '#161618',
  blue: '#1B6DFF', // One UI accent
  blueDeep: '#1428A0', // Samsung brand
  bubbleSent: '#0F7CFF',
  bubbleRecv: '#2A2A2E',
  teal: '#19C3C8',
};

const FPS = 30;
export const SAMSUNG_DURATION = 22 * FPS; // 660
export const SAMSUNG_WIDTH = 1920;
export const SAMSUNG_HEIGHT = 1080;

const base: React.CSSProperties = {
  fontFamily,
  fontWeight: 800,
  letterSpacing: '-0.02em',
  margin: 0,
};

const useFade = (inD = 10, outD = 10) => {
  const f = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  return (
    interpolate(f, [0, inD], [0, 1], {extrapolateRight: 'clamp'}) *
    interpolate(f, [durationInFrames - outD, durationInFrames], [1, 0], {extrapolateLeft: 'clamp'})
  );
};

// word-by-word blur + slide kinetic text (the reference's signature motion)
const Kinetic: React.FC<{
  words: {t: string; color?: string; weight?: number}[];
  fontSize: number;
  stagger?: number;
}> = ({words, fontSize, stagger = 7}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'baseline',
        fontSize,
        gap: `0 0.3em`,
        maxWidth: '92%',
      }}
    >
      {words.map((w, i) => {
        const s = spring({frame: frame - i * stagger, fps, config: {damping: 14, mass: 0.7, stiffness: 130}});
        const blur = interpolate(s, [0, 1], [14, 0]);
        const dx = interpolate(s, [0, 1], [40, 0]);
        return (
          <span
            key={i}
            style={{
              ...base,
              fontSize,
              fontWeight: w.weight ?? 800,
              color: w.color ?? C.ink,
              opacity: s,
              filter: `blur(${blur}px)`,
              transform: `translateX(${dx}px)`,
              display: 'inline-block',
            }}
          >
            {w.t}
          </span>
        );
      })}
    </div>
  );
};

const Glow: React.FC<{color: string; size?: number; opacity?: number}> = ({color, size = 1000, opacity = 0.5}) => {
  const f = useCurrentFrame();
  const pulse = interpolate(Math.sin(f * 0.12), [-1, 1], [0.85, 1.05]);
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: size,
        height: size,
        transform: `translate(-50%,-50%) scale(${pulse})`,
        background: `radial-gradient(circle, ${color} 0%, rgba(255,255,255,0) 60%)`,
        opacity,
        filter: 'blur(24px)',
      }}
    />
  );
};

// spring card entrance (scale + lift), like the reference UI cards
const useCardIn = (delay = 0) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - delay, fps, config: {damping: 15, mass: 0.9, stiffness: 90}});
  return {scale: interpolate(s, [0, 1], [0.82, 1]), y: interpolate(s, [0, 1], [60, 0]), o: s};
};

const Center: React.FC<{bg?: string; children: React.ReactNode}> = ({bg = C.light, children}) => (
  <AbsoluteFill style={{backgroundColor: bg, justifyContent: 'center', alignItems: 'center', padding: '0 70px'}}>
    {children}
  </AbsoluteFill>
);

// ---------- scenes ----------

const Hook: React.FC = () => {
  const o = useFade(8, 10);
  return (
    <Center>
      <Glow color="rgba(27,109,255,0.30)" />
      <div style={{opacity: o, position: 'relative'}}>
        <Kinetic
          fontSize={104}
          words={[
            {t: 'Is'},
            {t: 'it'},
            {t: 'possible'},
            {t: 'to'},
            {t: 'learn', color: C.blue, weight: 900},
          ]}
        />
      </div>
    </Center>
  );
};

const TimerCard: React.FC = () => {
  const o = useFade(8, 10);
  const {scale, y} = useCardIn(2);
  const frame = useCurrentFrame();
  const ring = interpolate(frame, [8, 46], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const R = 150;
  const circ = 2 * Math.PI * R;
  return (
    <Center>
      <div
        style={{
          opacity: o,
          transform: `translateY(${y}px) scale(${scale})`,
          width: 880,
          background: C.card,
          borderRadius: 56,
          padding: '70px 64px',
          display: 'flex',
          alignItems: 'center',
          gap: 56,
          boxShadow: '0 50px 120px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{position: 'relative', width: 340, height: 340, flexShrink: 0}}>
          <svg width="340" height="340" viewBox="0 0 340 340" style={{transform: 'rotate(-90deg)'}}>
            <circle cx="170" cy="170" r={R} fill="none" stroke="#2C2C30" strokeWidth="16" />
            <circle
              cx="170"
              cy="170"
              r={R}
              fill="none"
              stroke={C.blue}
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - ring)}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ...base,
              fontWeight: 700,
              fontSize: 96,
              color: '#fff',
            }}
          >
            20:00
          </div>
        </div>
        <div style={{...base, fontSize: 96, fontWeight: 800, color: C.blue}}>Focus</div>
        <div
          style={{
            marginLeft: 'auto',
            width: 150,
            height: 150,
            borderRadius: 999,
            background: 'rgba(27,109,255,0.18)',
            color: C.blue,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...base,
            fontSize: 40,
            fontWeight: 700,
          }}
        >
          Pause
        </div>
      </div>
    </Center>
  );
};

const SearchScene: React.FC = () => {
  const o = useFade(8, 10);
  const {scale, y} = useCardIn(2);
  const frame = useCurrentFrame();
  const typed = 'Samsung'.slice(0, Math.max(0, Math.floor(interpolate(frame, [20, 55], [0, 7], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}))));
  const caret = Math.floor(frame / 8) % 2 === 0;
  return (
    <Center bg={C.dark}>
      <div
        style={{
          opacity: o,
          transform: `translateY(${y}px) scale(${scale})`,
          width: 860,
          height: 150,
          borderRadius: 999,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 26,
          padding: '0 46px',
          boxShadow: '0 40px 100px rgba(0,0,0,0.45)',
        }}
      >
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="#444" strokeWidth="2.4" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="#444" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        <span style={{...base, fontWeight: 600, fontSize: 56, color: '#111'}}>
          {typed}
          <span style={{opacity: caret ? 1 : 0, color: C.blue}}>|</span>
        </span>
      </div>
    </Center>
  );
};

const FpsScene: React.FC = () => {
  const o = useFade(8, 10);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame, fps, config: {damping: 13, mass: 0.7, stiffness: 140}});
  return (
    <Center>
      <Glow color="rgba(27,109,255,0.32)" />
      <div
        style={{
          opacity: o,
          position: 'relative',
          transform: `scale(${interpolate(s, [0, 1], [0.7, 1])})`,
          filter: `blur(${interpolate(s, [0, 1], [14, 0])}px)`,
        }}
      >
        <div style={{...base, fontSize: 110, fontWeight: 900, color: C.blue, textShadow: '0 0 60px rgba(27,109,255,0.55)', textAlign: 'center'}}>
          120 Frames
          <br />
          Per Second
        </div>
      </div>
    </Center>
  );
};

const NotesCard: React.FC = () => {
  const o = useFade(8, 10);
  const {scale, y} = useCardIn(2);
  const Tool = ({children}: {children: React.ReactNode}) => (
    <div style={{width: 64, height: 64, borderRadius: 18, background: '#202024', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bdbdbd', ...base, fontSize: 30}}>{children}</div>
  );
  return (
    <Center>
      <div
        style={{
          opacity: o,
          transform: `translateY(${y}px) scale(${scale})`,
          width: 1180,
          height: 760,
          background: '#0C0C0E',
          borderRadius: 56,
          padding: 48,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 50px 120px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <div style={{width: 72, height: 72, borderRadius: 999, background: '#202024', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40}}>‹</div>
          <div style={{width: 72, height: 72, borderRadius: 999, background: C.blue, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38}}>✓</div>
        </div>
        <div style={{marginTop: 70}}>
          <Kinetic
            fontSize={70}
            stagger={6}
            words={[
              {t: 'Most', color: '#fff'},
              {t: 'people', color: '#fff'},
              {t: "don't", color: '#fff'},
              {t: 'realize', color: '#fff', weight: 900},
            ]}
          />
        </div>
        <div style={{marginTop: 'auto', display: 'flex', gap: 24}}>
          <Tool>Aa</Tool>
          <Tool>☰</Tool>
          <Tool>▦</Tool>
          <Tool>🔗</Tool>
          <Tool>✎</Tool>
        </div>
      </div>
    </Center>
  );
};

const Bubble: React.FC<{
  text: React.ReactNode;
  side: 'left' | 'right';
  color: string;
  delay: number;
  fontSize?: number;
}> = ({text, side, color, delay, fontSize = 58}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - delay, fps, config: {damping: 12, mass: 0.7, stiffness: 130}});
  if (frame < delay) return null;
  return (
    <div
      style={{
        alignSelf: side === 'left' ? 'flex-start' : 'flex-end',
        transform: `translateY(${interpolate(s, [0, 1], [50, 0])}px) scale(${s})`,
        opacity: s,
        background: color,
        color: '#fff',
        padding: '30px 44px',
        borderRadius: 44,
        ...base,
        fontWeight: 700,
        fontSize,
        maxWidth: '85%',
        boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
      }}
    >
      {text}
    </div>
  );
};

const MessagesScene: React.FC = () => {
  const o = useFade(8, 10);
  return (
    <Center>
      <div style={{opacity: o, width: '100%', display: 'flex', flexDirection: 'column', gap: 40}}>
        <Bubble side="left" color={C.bubbleRecv} delay={4} text={<span>🧈🧈🧈 Buttery Smooth</span>} />
        <Bubble side="right" color={C.bubbleSent} delay={26} text={<span>Samsung Style Animations</span>} />
      </div>
    </Center>
  );
};

const Outro: React.FC = () => {
  const o = useFade(10, 6);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame, fps, config: {damping: 13, mass: 0.9, stiffness: 100}});
  return (
    <Center>
      <Glow color="rgba(20,40,160,0.4)" size={1200} opacity={0.55} />
      <div style={{opacity: o, textAlign: 'center', transform: `scale(${interpolate(s, [0, 1], [0.7, 1])})`, position: 'relative'}}>
        <div style={{...base, fontSize: 120, fontWeight: 900, color: C.blueDeep}}>Samsung</div>
        <div style={{...base, fontSize: 84, fontWeight: 800, color: C.ink, letterSpacing: '0.02em'}}>Style Animations</div>
      </div>
    </Center>
  );
};

// ---------- master ----------

export const SamsungAd: React.FC = () => {
  const seq = (from: number, dur: number, el: React.ReactNode) => (
    <Sequence from={from} durationInFrames={dur}>
      {el}
    </Sequence>
  );
  return (
    <AbsoluteFill style={{backgroundColor: C.light}}>
      <Audio src={staticFile('audio/samsung-mix.m4a')} volume={1} />
      {seq(0, 90, <Hook />)}
      {seq(90, 120, <TimerCard />)}
      {seq(210, 90, <SearchScene />)}
      {seq(300, 90, <FpsScene />)}
      {seq(390, 120, <NotesCard />)}
      {seq(510, 90, <MessagesScene />)}
      {seq(600, 60, <Outro />)}
    </AbsoluteFill>
  );
};
