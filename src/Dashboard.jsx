import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ROW = ({ label, value, color, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.4 }}
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '2px 8px',
      borderBottom: '1px solid rgba(124,58,237,0.12)',
    }}
  >
    <span style={{ color: '#a78bfa', fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
    <motion.span
      key={value}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ color, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', fontFamily: 'monospace' }}
    >
      {value}
    </motion.span>
  </motion.div>
);

export default function Dashboard({ scene, candleIndex }) {
  const isBullish = scene >= 3 && scene <= 5;
  const isBearish = scene === 1 || scene === 6;
  const isTransition = scene === 2;

  const trend = isBullish ? 'BULLISH' : isBearish ? 'BEARISH' : 'NEUTRAL';
  const trendColor = isBullish ? '#22c55e' : isBearish ? '#ef4444' : '#f59e0b';

  const score = isBullish
    ? Math.min(85, 55 + (candleIndex - 12) * 4)
    : isBearish
    ? Math.max(15, 70 - candleIndex * 3)
    : 40;

  const rsi = scene <= 2
    ? Math.max(22, 58 - candleIndex * 4)
    : scene <= 5
    ? Math.min(72, 28 + (candleIndex - 12) * 5)
    : 65;

  const rsiLabel = rsi < 30 ? 'OVERSOLD' : rsi > 70 ? 'OVERBOUGHT' : 'NEUTRAL';
  const rsiColor = rsi < 30 ? '#22c55e' : rsi > 70 ? '#ef4444' : '#f59e0b';

  const reversalPct = scene >= 5 ? `${Math.min(78, 45 + (candleIndex - 21) * 11)}%` : scene >= 3 ? `${Math.min(45, (candleIndex - 12) * 5)}%` : '—';

  const resistance = scene >= 5 ? 'DETECTED' : '—';
  const resistanceColor = scene >= 5 ? '#ef4444' : '#6b7280';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.5 }}
      style={{
        position: 'absolute',
        bottom: 14,
        left: 14,
        width: 195,
        background: 'rgba(10,10,20,0.92)',
        border: '1px solid rgba(124,58,237,0.35)',
        borderRadius: 6,
        overflow: 'hidden',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 0 18px rgba(124,58,237,0.2)',
        zIndex: 20,
      }}
    >
      {/* Header */}
      <div style={{
        background: 'linear-gradient(90deg, rgba(124,58,237,0.5) 0%, rgba(190,24,93,0.3) 100%)',
        padding: '4px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: trendColor,
          boxShadow: `0 0 6px ${trendColor}`,
        }} />
        <span style={{ color: '#e9d5ff', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em' }}>
          TUX S&D + KINETIC
        </span>
      </div>

      <ROW label="Trend" value={trend} color={trendColor} delay={0} />
      <ROW label="Signal Score" value={`${Math.round(score)}/100`} color={score > 60 ? '#22c55e' : score < 40 ? '#ef4444' : '#f59e0b'} delay={0.05} />
      <ROW label="RSI" value={`${Math.round(rsi)} — ${rsiLabel}`} color={rsiColor} delay={0.1} />
      <ROW label="Reversal %" value={reversalPct} color="#a78bfa" delay={0.15} />
      <ROW label="Resistance" value={resistance} color={resistanceColor} delay={0.2} />

      {/* Score bar */}
      <div style={{ padding: '4px 8px 6px' }}>
        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              height: '100%',
              background: `linear-gradient(90deg, ${trendColor}88, ${trendColor})`,
              borderRadius: 2,
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}
