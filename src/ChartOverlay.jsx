import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CHART, CANDLES, KINETIC, priceToY, indexToX, TOTAL_CANDLES } from './chartData.jsx';

const { width, height, longPower, shortPower, paddingLeft, paddingRight } = CHART;
const chartRight = width - paddingRight;

// ── Helpers ────────────────────────────────────────────────────────────────

function CandleBar({ candle, index, total, visible, delay = 0 }) {
  if (!visible) return null;
  const x = indexToX(index, total);
  const cw = Math.max(5, ((width - paddingLeft - paddingRight) / total) * 0.55);
  const isBull = candle.c >= candle.o;
  const bodyTop = priceToY(Math.max(candle.o, candle.c));
  const bodyBot = priceToY(Math.min(candle.o, candle.c));
  const bodyH = Math.max(1.5, bodyBot - bodyTop);
  const wickTop = priceToY(candle.h);
  const wickBot = priceToY(candle.l);
  const fill = isBull ? '#22c55e' : '#ef4444';
  const glow = isBull ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)';

  return (
    <motion.g
      initial={{ scaleY: 0, opacity: 0 }}
      animate={{ scaleY: 1, opacity: 1 }}
      transition={{ duration: 0.25, delay, ease: 'backOut' }}
      style={{ transformOrigin: `${x}px ${(bodyTop + bodyBot) / 2}px` }}
    >
      {/* Wick */}
      <line x1={x} y1={wickTop} x2={x} y2={wickBot} stroke={fill} strokeWidth={1} opacity={0.7} />
      {/* Body */}
      <rect
        x={x - cw / 2} y={bodyTop} width={cw} height={bodyH}
        fill={fill}
        rx={1}
        style={{ filter: `drop-shadow(0 0 3px ${glow})` }}
      />
    </motion.g>
  );
}

function KineticLine({ points, scene }) {
  if (points.length < 2) return null;
  const isBearish = scene <= 2 || scene === 6;
  const color = isBearish ? '#c084fc' : '#a855f7';
  const d = points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
    .join(' ');

  return (
    <g>
      {/* Glow layer */}
      <motion.path
        d={d} fill="none" stroke={color} strokeWidth={4} opacity={0.18}
        style={{ filter: 'blur(4px)' }}
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />
      {/* Main line */}
      <motion.path
        d={d} fill="none" stroke={color} strokeWidth={1.8}
        strokeDasharray="4 3"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />
      {/* Leading dot */}
      {points.length > 0 && (
        <motion.circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={3.5} fill={color}
          animate={{ opacity: [1, 0.3, 1], r: [3.5, 5, 3.5] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}
    </g>
  );
}

function PowerZone({ price, type, active, glowing }) {
  const y = priceToY(price);
  const zonePad = 6;
  const top = type === 'long' ? y : y - zonePad;
  const bot = type === 'long' ? y + zonePad : y;
  const color = type === 'long' ? '#22c55e' : '#ef4444';
  const label = type === 'long' ? `LONG POWER  ${price}` : `SHORT POWER  ${price}`;
  const gradId = `grad_${type}`;

  if (!active) return null;

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: glowing ? 1 : 0.55 }}
      transition={{ duration: 0.8 }}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity={glowing ? 0.22 : 0.1} />
          <stop offset="100%" stopColor={color} stopOpacity={0.04} />
        </linearGradient>
      </defs>
      {/* Zone fill */}
      <rect x={paddingLeft} y={top} width={chartRight - paddingLeft} height={bot - top}
        fill={`url(#${gradId})`} />
      {/* Zone border */}
      <motion.line
        x1={paddingLeft} y1={y} x2={chartRight} y2={y}
        stroke={color} strokeWidth={glowing ? 1.5 : 0.8}
        strokeDasharray={type === 'long' ? '6 3' : 'none'}
        animate={glowing ? { opacity: [0.8, 1, 0.8] } : { opacity: 0.6 }}
        transition={{ duration: 1.4, repeat: Infinity }}
        style={glowing ? { filter: `drop-shadow(0 0 4px ${color})` } : {}}
      />
      {/* Label */}
      <text x={paddingLeft + 8} y={y - 5} fill={color} fontSize={8.5}
        fontFamily="monospace" letterSpacing="0.08em" opacity={0.9}>
        {label}
      </text>
    </motion.g>
  );
}

function SDBox({ x1, x2, topPrice, botPrice, bullish, visible }) {
  if (!visible) return null;
  const y1 = priceToY(topPrice);
  const y2 = priceToY(botPrice);
  const color = bullish ? '#22c55e' : '#ef4444';
  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 0.55 }} transition={{ duration: 0.6 }}>
      <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1}
        fill={`${color}12`} stroke={color} strokeWidth={0.8}
        strokeDasharray="3 2" rx={1} />
    </motion.g>
  );
}

function SignalLabel({ x, y, type, visible, delay = 0 }) {
  if (!visible) return null;
  const isBuy = type === 'BUY';
  const color = isBuy ? '#22c55e' : '#ef4444';
  const arrowY = isBuy ? y + 18 : y - 18;
  const arrowD = isBuy
    ? `M ${x} ${arrowY - 6} L ${x - 5} ${arrowY - 14} L ${x + 5} ${arrowY - 14} Z`
    : `M ${x} ${arrowY + 6} L ${x - 5} ${arrowY + 14} L ${x + 5} ${arrowY + 14} Z`;

  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, delay, type: 'spring', stiffness: 260 }}
      style={{ transformOrigin: `${x}px ${y}px` }}
    >
      <path d={arrowD} fill={color} opacity={0.9}
        style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
      <rect x={x - 14} y={isBuy ? y + 22 : y - 38} width={28} height={14}
        fill={`${color}22`} stroke={color} strokeWidth={0.8} rx={3} />
      <text x={x} y={isBuy ? y + 32 : y - 28} textAnchor="middle"
        fill={color} fontSize={8.5} fontWeight="700" fontFamily="monospace"
        letterSpacing="0.1em">
        {type}
      </text>
    </motion.g>
  );
}

function ProjectionPath({ fromIndex, total, visible }) {
  if (!visible) return null;
  const pts = [
    { x: indexToX(fromIndex, total), y: priceToY(55.2) },
    { x: indexToX(fromIndex + 1, total), y: priceToY(57.5) },
    { x: indexToX(fromIndex + 2, total), y: priceToY(60.5) },
    { x: indexToX(fromIndex + 3, total), y: priceToY(63.5) },
    { x: indexToX(fromIndex + 4, total), y: priceToY(66.0) },
    { x: indexToX(fromIndex + 5, total), y: priceToY(68.0) },
  ];
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
      <motion.path
        d={d} fill="none" stroke="#f59e0b" strokeWidth={1.5}
        strokeDasharray="5 4"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: 'easeInOut' }}
        style={{ filter: 'drop-shadow(0 0 4px rgba(245,158,11,0.6))' }}
      />
      {pts.map((p, i) => (
        <motion.circle key={i} cx={p.x} cy={p.y} r={2}
          fill="#f59e0b" opacity={0.7}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: i * 0.18, duration: 0.2 }}
        />
      ))}
    </motion.g>
  );
}

// ── Main overlay ────────────────────────────────────────────────────────────

export default function ChartOverlay({ scene, candleIndex }) {
  const visibleCandles = CANDLES.slice(0, candleIndex + 1);
  const total = TOTAL_CANDLES;

  const kineticPts = visibleCandles.map((_, i) => ({
    x: indexToX(i, total),
    y: priceToY(KINETIC[i]),
  }));

  const showLong = scene >= 2;
  const longGlowing = scene === 2;
  const showShort = scene >= 5;
  const shortGlowing = scene === 5 || scene === 6;

  const buyIdx = 15; // scene 3 BUY
  const sellIdx1 = 7; // scene 1 SELL
  const sellIdx2 = 24; // scene 6 SELL

  const showBuy = candleIndex >= buyIdx && scene >= 3;
  const showSell1 = candleIndex >= sellIdx1 && scene >= 1 && scene <= 3;
  const showSell2 = candleIndex >= sellIdx2 && scene >= 6;
  const showProjection = scene === 4;

  // S&D boxes
  const sdBoxes = [
    { x1: indexToX(8, total), x2: indexToX(12, total), top: 50.8, bot: 48.4, bull: true, show: scene >= 2 },
    { x1: indexToX(21, total), x2: indexToX(24, total), top: 69.0, bot: 67.2, bull: false, show: scene >= 5 },
  ];

  return (
    <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0, zIndex: 10 }}>
      {/* Grid lines */}
      {[46, 50, 54, 58, 62, 66, 70].map(p => (
        <line key={p} x1={paddingLeft} y1={priceToY(p)} x2={chartRight} y2={priceToY(p)}
          stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
      ))}

      {/* S&D boxes */}
      {sdBoxes.map((b, i) => (
        <SDBox key={i} x1={b.x1} x2={b.x2} topPrice={b.top} botPrice={b.bot}
          bullish={b.bull} visible={b.show} />
      ))}

      {/* Power zones */}
      <PowerZone price={longPower} type="long" active={showLong} glowing={longGlowing} />
      <PowerZone price={shortPower} type="short" active={showShort} glowing={shortGlowing} />

      {/* Projection path */}
      <ProjectionPath fromIndex={buyIdx} total={total} visible={showProjection} />

      {/* Candles */}
      {visibleCandles.map((c, i) => (
        <CandleBar key={i} candle={c} index={i} total={total} visible delay={i * 0.02} />
      ))}

      {/* Kinetic trailing stop */}
      <KineticLine points={kineticPts} scene={scene} />

      {/* Signals */}
      <SignalLabel
        x={indexToX(sellIdx1, total)} y={priceToY(CANDLES[sellIdx1].h)}
        type="SELL" visible={showSell1} delay={0.2} />
      <SignalLabel
        x={indexToX(buyIdx, total)} y={priceToY(CANDLES[buyIdx].l)}
        type="BUY" visible={showBuy} delay={0.2} />
      <SignalLabel
        x={indexToX(sellIdx2, total)} y={priceToY(CANDLES[sellIdx2].h)}
        type="SELL" visible={showSell2} delay={0.2} />

      {/* Price labels on right axis */}
      {[46, 50, 54, 58, 62, 66, 70].map(p => (
        <text key={p} x={chartRight + 6} y={priceToY(p) + 3.5}
          fill="rgba(167,139,250,0.5)" fontSize={8} fontFamily="monospace">
          {p}
        </text>
      ))}

      {/* Power level price callouts */}
      {showLong && (
        <text x={chartRight + 6} y={priceToY(longPower) + 3.5}
          fill="#22c55e" fontSize={8.5} fontFamily="monospace" fontWeight="700">
          {longPower}
        </text>
      )}
      {showShort && (
        <text x={chartRight + 6} y={priceToY(shortPower) + 3.5}
          fill="#ef4444" fontSize={8.5} fontFamily="monospace" fontWeight="700">
          {shortPower}
        </text>
      )}
    </svg>
  );
}
