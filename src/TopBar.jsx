import React from 'react';
import { motion } from 'framer-motion';
import { CANDLES } from './chartData.jsx';

export default function TopBar({ candleIndex, scene }) {
  const candle = CANDLES[Math.max(0, candleIndex)];
  const price = candle ? candle.c.toFixed(2) : '—';
  const isBull = candle && candle.c >= candle.o;
  const change = candle ? ((candle.c - candle.o) / candle.o * 100).toFixed(2) : '0.00';
  const priceColor = isBull ? '#22c55e' : '#ef4444';

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      height: 32,
      background: 'linear-gradient(90deg, rgba(10,5,25,0.97) 0%, rgba(20,5,35,0.95) 100%)',
      borderBottom: '1px solid rgba(124,58,237,0.2)',
      display: 'flex', alignItems: 'center', padding: '0 14px',
      gap: 16, zIndex: 40,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 20, height: 20, borderRadius: 4,
          background: 'linear-gradient(135deg, #7c3aed, #be185d)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 900, color: '#fff', fontFamily: 'monospace',
          boxShadow: '0 0 8px rgba(124,58,237,0.6)',
        }}>T</div>
        <span style={{ color: '#e9d5ff', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em' }}>
          TUX S&amp;D + KINETIC
        </span>
      </div>

      <div style={{ width: 1, height: 16, background: 'rgba(124,58,237,0.3)' }} />

      {/* Symbol */}
      <span style={{ color: '#a78bfa', fontSize: 10, fontFamily: 'monospace', fontWeight: 600 }}>
        CRYPTO / 1H
      </span>

      <div style={{ width: 1, height: 16, background: 'rgba(124,58,237,0.3)' }} />

      {/* Price */}
      <motion.span
        key={price}
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        style={{ color: priceColor, fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }}
      >
        {price}
      </motion.span>
      <span style={{ color: priceColor, fontSize: 9, fontFamily: 'monospace' }}>
        {isBull ? '▲' : '▼'} {Math.abs(change)}%
      </span>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Scene indicator */}
      <span style={{
        color: 'rgba(167,139,250,0.5)', fontSize: 8.5,
        fontFamily: 'monospace', letterSpacing: '0.08em',
      }}>
        SCENE {scene}/6
      </span>

      {/* Live dot */}
      <motion.div
        animate={{ opacity: [1, 0.2, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#22c55e',
          boxShadow: '0 0 5px #22c55e',
        }}
      />
      <span style={{ color: '#22c55e', fontSize: 8, fontFamily: 'monospace' }}>LIVE</span>
    </div>
  );
}
