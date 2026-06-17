import React from 'react';
import {interpolate} from 'remotion';
import {COLORS} from '../theme';

/**
 * Stylized candlestick chart with supply/demand zones, used as a stand-in
 * "app screenshot" for the structure / setups scenes. Swap with a real
 * screenshot by dropping an image in public/ and using <Img src={staticFile()}/>.
 */

type Candle = {o: number; c: number; h: number; l: number};

// Deterministic pseudo-random walk so the chart looks like a real uptrend.
const buildCandles = (count: number): Candle[] => {
  const candles: Candle[] = [];
  let price = 40;
  let seed = 7;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < count; i++) {
    const drift = 0.9 + (i / count) * 0.6;
    const o = price;
    const move = (rand() - 0.42) * 7 * drift;
    const c = Math.max(6, o + move);
    const h = Math.max(o, c) + rand() * 4;
    const l = Math.min(o, c) - rand() * 4;
    candles.push({o, c, h, l});
    price = c;
  }
  return candles;
};

const CANDLES = buildCandles(34);
const MIN = Math.min(...CANDLES.map((c) => c.l)) - 4;
const MAX = Math.max(...CANDLES.map((c) => c.h)) + 6;

export const MockChart: React.FC<{
  reveal: number; // 0..1 draw-in progress
  demandZone?: [number, number];
  supplyZone?: [number, number];
  highlightSetups?: boolean;
}> = ({reveal, demandZone, supplyZone, highlightSetups}) => {
  const W = 900;
  const H = 1100;
  const padX = 30;
  const padY = 40;
  const plotW = W - padX * 2;
  const plotH = H - padY * 2;

  const x = (i: number) => padX + (i / (CANDLES.length - 1)) * plotW;
  const y = (v: number) =>
    padY + plotH - ((v - MIN) / (MAX - MIN)) * plotH;

  const visibleCount = Math.floor(reveal * CANDLES.length);
  const candleW = (plotW / CANDLES.length) * 0.6;

  const zoneRect = (zone: [number, number], color: string) => {
    const top = y(Math.max(zone[0], zone[1]));
    const bottom = y(Math.min(zone[0], zone[1]));
    return (
      <rect
        x={padX}
        y={top}
        width={plotW}
        height={bottom - top}
        fill={color}
        rx={6}
      />
    );
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{width: '100%', height: '100%', display: 'block'}}
    >
      {/* grid */}
      {Array.from({length: 6}).map((_, i) => (
        <line
          key={i}
          x1={padX}
          x2={W - padX}
          y1={padY + (plotH / 5) * i}
          y2={padY + (plotH / 5) * i}
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={1}
        />
      ))}

      {demandZone ? zoneRect(demandZone, COLORS.zoneDemand) : null}
      {supplyZone ? zoneRect(supplyZone, COLORS.zoneSupply) : null}

      {CANDLES.map((c, i) => {
        if (i > visibleCount) return null;
        const up = c.c >= c.o;
        const color = up ? COLORS.brand : COLORS.red;
        const cx = x(i);
        const bodyTop = y(Math.max(c.o, c.c));
        const bodyBottom = y(Math.min(c.o, c.c));
        return (
          <g key={i}>
            <line
              x1={cx}
              x2={cx}
              y1={y(c.h)}
              y2={y(c.l)}
              stroke={color}
              strokeWidth={2}
            />
            <rect
              x={cx - candleW / 2}
              y={bodyTop}
              width={candleW}
              height={Math.max(2, bodyBottom - bodyTop)}
              fill={color}
              rx={2}
            />
          </g>
        );
      })}

      {highlightSetups && reveal > 0.7
        ? [10, 22].map((idx, k) => {
            const cy = y(CANDLES[idx].l) + 26;
            const pulse = interpolate(
              (reveal * 10 + k) % 1,
              [0, 0.5, 1],
              [0.9, 1.15, 0.9]
            );
            return (
              <g key={idx} transform={`translate(${x(idx)} ${cy}) scale(${pulse})`}>
                <circle r={20} fill="none" stroke={COLORS.brand} strokeWidth={3} />
                <path
                  d="M -8 -4 L 0 -12 L 8 -4"
                  fill="none"
                  stroke={COLORS.brand}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })
        : null}
    </svg>
  );
};
