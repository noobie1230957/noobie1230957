import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LABELS = {
  1: { title: 'BEARISH TREND', sub: 'Kinetic Stop trailing above price', color: '#ef4444' },
  2: { title: 'LONG POWER LEVEL', sub: 'Price at 49 — RSI Oversold', color: '#22c55e' },
  3: { title: 'BUY SIGNAL CONFIRMED', sub: 'Kinetic Stop flips below price', color: '#22c55e' },
  4: { title: 'RALLY IN PROGRESS', sub: 'Target projection activated', color: '#f59e0b' },
  5: { title: 'SHORT POWER LEVEL', sub: 'Resistance detected at 68', color: '#ef4444' },
  6: { title: 'SELL SIGNAL', sub: 'Rejection from Short Power Level', color: '#be185d' },
};

export default function SceneLabel({ scene }) {
  const info = LABELS[scene];
  if (!info) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={scene}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.5 }}
        style={{
          position: 'absolute',
          top: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          zIndex: 30,
          pointerEvents: 'none',
        }}
      >
        <div style={{
          background: 'rgba(10,10,20,0.82)',
          border: `1px solid ${info.color}55`,
          borderRadius: 6,
          padding: '5px 16px',
          backdropFilter: 'blur(6px)',
          boxShadow: `0 0 16px ${info.color}33`,
        }}>
          <div style={{
            color: info.color, fontSize: 11, fontWeight: 800,
            letterSpacing: '0.15em', fontFamily: 'monospace',
          }}>
            {info.title}
          </div>
          <div style={{
            color: 'rgba(200,180,255,0.7)', fontSize: 8.5, marginTop: 2,
            letterSpacing: '0.08em', fontFamily: 'monospace',
          }}>
            {info.sub}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
