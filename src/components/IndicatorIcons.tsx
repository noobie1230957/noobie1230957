import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {COLORS} from '../theme';
import {fontFamily} from '../font';

type Indicator = {
  label: string;
  x: number; // % of width
  y: number; // % of height
  delay: number;
  icon: React.ReactNode;
};

const Sparkline: React.FC = () => (
  <svg width="64" height="36" viewBox="0 0 64 36">
    <polyline
      points="2,28 12,20 20,30 30,10 40,22 52,6 62,16"
      fill="none"
      stroke={COLORS.ink}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Bars: React.FC = () => (
  <svg width="64" height="36" viewBox="0 0 64 36">
    {[6, 22, 12, 30, 18, 26].map((h, i) => (
      <rect
        key={i}
        x={4 + i * 10}
        y={34 - h}
        width="6"
        height={h}
        rx="2"
        fill={i % 2 ? COLORS.red : COLORS.ink}
      />
    ))}
  </svg>
);

const Bands: React.FC = () => (
  <svg width="64" height="36" viewBox="0 0 64 36">
    <path d="M2,8 C20,2 44,2 62,8" fill="none" stroke={COLORS.inkSoft} strokeWidth="2" />
    <path d="M2,18 C20,14 44,22 62,18" fill="none" stroke={COLORS.ink} strokeWidth="3" />
    <path d="M2,28 C20,34 44,34 62,28" fill="none" stroke={COLORS.inkSoft} strokeWidth="2" />
  </svg>
);

const INDICATORS: Indicator[] = [
  {label: 'RSI', x: 22, y: 26, delay: 4, icon: <Sparkline />},
  {label: 'MACD', x: 74, y: 38, delay: 10, icon: <Bars />},
  {label: 'BB', x: 30, y: 70, delay: 16, icon: <Bands />},
  {label: 'EMA', x: 78, y: 74, delay: 22, icon: <Sparkline />},
  {label: 'STOCH', x: 50, y: 16, delay: 28, icon: <Bars />},
];

export const IndicatorIcons: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  return (
    <>
      {INDICATORS.map((ind) => {
        const appear = spring({
          frame: frame - ind.delay,
          fps,
          config: {damping: 12, mass: 0.7},
        });
        // gentle floating drift
        const t = (frame + ind.delay * 3) / fps;
        const floatY = Math.sin(t * 1.6) * 14;
        const floatX = Math.cos(t * 1.1) * 10;
        const rot = Math.sin(t * 0.9) * 4;
        const px = (ind.x / 100) * width + floatX;
        const py = (ind.y / 100) * height + floatY;
        const opacity = interpolate(appear, [0, 1], [0, 1]);

        return (
          <div
            key={ind.label}
            style={{
              position: 'absolute',
              left: px,
              top: py,
              transform: `translate(-50%, -50%) scale(${appear}) rotate(${rot}deg)`,
              opacity,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              padding: '22px 26px',
              background: '#FFFFFF',
              borderRadius: 28,
              boxShadow: '0 24px 60px rgba(0,0,0,0.10)',
            }}
          >
            {ind.icon}
            <span
              style={{
                fontFamily,
                fontWeight: 800,
                fontSize: 30,
                letterSpacing: '0.04em',
                color: COLORS.ink,
              }}
            >
              {ind.label}
            </span>
          </div>
        );
      })}
    </>
  );
};
