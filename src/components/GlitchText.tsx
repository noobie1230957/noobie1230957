import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily} from '../font';

// Deterministic jitter so renders are reproducible.
const noise = (f: number, salt: number) => {
  const v = Math.sin(f * 12.9898 + salt * 78.233) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
};

export const GlitchText: React.FC<{
  text: string;
  fontSize: number;
}> = ({text, fontSize}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const enter = interpolate(frame, [0, 8], [0, 1], {extrapolateRight: 'clamp'});
  const exit = interpolate(
    frame,
    [durationInFrames - 8, durationInFrames],
    [1, 0],
    {extrapolateLeft: 'clamp'}
  );
  const opacity = enter * exit;

  // glitch bursts a few times across the scene
  const burst = Math.max(
    0,
    Math.sin(frame * 0.7) > 0.6 ? 1 : 0,
    frame % 17 < 2 ? 1 : 0
  );
  const jx = noise(frame, 1) * 10 * burst;
  const slice = noise(frame, 9) * 14 * burst;

  const base: React.CSSProperties = {
    position: 'absolute',
    fontFamily,
    fontWeight: 900,
    fontSize,
    letterSpacing: '-0.02em',
    textAlign: 'center',
    lineHeight: 1.05,
    width: '90%',
    left: '5%',
  };

  return (
    <div style={{opacity, position: 'relative', width: '100%'}}>
      {/* red channel */}
      <div
        style={{
          ...base,
          color: '#FF2D2D',
          transform: `translate(${-slice}px, 0) skewX(${jx * 0.3}deg)`,
          mixBlendMode: 'screen',
        }}
      >
        {text}
      </div>
      {/* cyan channel */}
      <div
        style={{
          ...base,
          color: '#2DE2FF',
          transform: `translate(${slice}px, 0) skewX(${-jx * 0.3}deg)`,
          mixBlendMode: 'screen',
        }}
      >
        {text}
      </div>
      {/* main white */}
      <div
        style={{
          ...base,
          color: '#FFFFFF',
          transform: `translate(${jx}px, 0)`,
        }}
      >
        {text}
      </div>
    </div>
  );
};
