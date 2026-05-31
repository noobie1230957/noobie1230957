import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ParticleField from './ParticleField.jsx';
import ChartOverlay from './ChartOverlay.jsx';
import Dashboard from './Dashboard.jsx';
import SceneLabel from './SceneLabel.jsx';
import TopBar from './TopBar.jsx';
import { CANDLES, SCENE_TIMES, TOTAL_CANDLES } from './chartData.jsx';

const TOTAL_DURATION = 24000; // 24 seconds
const CANVAS_W = 960;
const CANVAS_H = 540;

// Map elapsed time to { scene, candleIndex }
function timeToState(ms) {
  const t = Math.min(ms / TOTAL_DURATION, 1);
  const candleIndex = Math.floor(t * (TOTAL_CANDLES - 1));

  // Scene boundaries by candle index
  const sceneBreaks = [0, 8, 12, 16, 21, 24, TOTAL_CANDLES];
  let scene = 1;
  for (let i = sceneBreaks.length - 1; i >= 1; i--) {
    if (candleIndex >= sceneBreaks[i - 1]) { scene = i; break; }
  }

  return { scene: Math.min(6, scene), candleIndex };
}

function GlowVignette({ scene }) {
  const colors = {
    1: 'rgba(239,68,68,0.06)',
    2: 'rgba(34,197,94,0.07)',
    3: 'rgba(34,197,94,0.09)',
    4: 'rgba(245,158,11,0.07)',
    5: 'rgba(239,68,68,0.08)',
    6: 'rgba(190,24,93,0.1)',
  };
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={scene}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.2 }}
        style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at 50% 50%, ${colors[scene] || 'transparent'} 0%, transparent 70%)`,
          pointerEvents: 'none', zIndex: 1,
        }}
      />
    </AnimatePresence>
  );
}

function ScanLine() {
  return (
    <motion.div
      animate={{ y: [0, CANVAS_H, 0] }}
      transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      style={{
        position: 'absolute', left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.15), transparent)',
        pointerEvents: 'none', zIndex: 2,
      }}
    />
  );
}

function CornerBracket({ corner }) {
  const size = 12;
  const style = {
    position: 'absolute',
    width: size, height: size,
    zIndex: 50,
    ...(corner === 'tl' ? { top: 36, left: 0 } : {}),
    ...(corner === 'tr' ? { top: 36, right: 0 } : {}),
    ...(corner === 'bl' ? { bottom: 0, left: 0 } : {}),
    ...(corner === 'br' ? { bottom: 0, right: 0 } : {}),
  };
  const borderStyle = '1px solid rgba(124,58,237,0.5)';
  const borders = {
    tl: { borderTop: borderStyle, borderLeft: borderStyle },
    tr: { borderTop: borderStyle, borderRight: borderStyle },
    bl: { borderBottom: borderStyle, borderLeft: borderStyle },
    br: { borderBottom: borderStyle, borderRight: borderStyle },
  };
  return <div style={{ ...style, ...borders[corner] }} />;
}

export default function App() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const startRef = useRef(null);
  const rafRef = useRef(null);

  const tick = useCallback(() => {
    if (!startRef.current) return;
    const now = performance.now();
    const ms = now - startRef.current;
    if (ms >= TOTAL_DURATION) {
      setElapsed(TOTAL_DURATION);
      setRunning(false);
      setCompleted(true);
      return;
    }
    setElapsed(ms);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(() => {
    setElapsed(0);
    setCompleted(false);
    setRunning(true);
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const { scene, candleIndex } = timeToState(elapsed);

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#050508',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Outer frame */}
      <div style={{
        position: 'relative',
        width: CANVAS_W, height: CANVAS_H,
        background: 'linear-gradient(160deg, #0a0812 0%, #06050e 50%, #0a0510 100%)',
        borderRadius: 8,
        border: '1px solid rgba(124,58,237,0.28)',
        overflow: 'hidden',
        boxShadow: '0 0 60px rgba(124,58,237,0.18), 0 0 120px rgba(124,58,237,0.08), inset 0 0 60px rgba(0,0,0,0.4)',
      }}>
        {/* Particles */}
        <ParticleField width={CANVAS_W} height={CANVAS_H} scene={scene} />

        {/* Ambient glow */}
        <GlowVignette scene={scene} />

        {/* Scan line effect */}
        <ScanLine />

        {/* Corner brackets */}
        <CornerBracket corner="tl" />
        <CornerBracket corner="tr" />
        <CornerBracket corner="bl" />
        <CornerBracket corner="br" />

        {/* Top bar */}
        <TopBar candleIndex={candleIndex} scene={scene} />

        {/* Chart area */}
        <div style={{ position: 'absolute', top: 32, left: 0, right: 0, bottom: 0 }}>
          <ChartOverlay scene={scene} candleIndex={candleIndex} />
          <Dashboard scene={scene} candleIndex={candleIndex} />
        </div>

        {/* Scene label */}
        <SceneLabel scene={scene} />

        {/* Bottom branding bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 18,
          background: 'linear-gradient(90deg, rgba(124,58,237,0.15) 0%, rgba(190,24,93,0.1) 100%)',
          borderTop: '1px solid rgba(124,58,237,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 12, zIndex: 40,
        }}>
          <span style={{
            color: 'rgba(167,139,250,0.6)', fontSize: 7.5,
            fontFamily: 'monospace', letterSpacing: '0.2em', textTransform: 'uppercase',
          }}>
            TUX S&amp;D + KINETIC INDICATOR &nbsp;·&nbsp; Supply &amp; Demand &nbsp;·&nbsp; Kinetic Trailing Stop &nbsp;·&nbsp; Power Levels
          </span>
        </div>

        {/* Play / Replay overlay */}
        <AnimatePresence>
          {!running && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={start}
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(5,5,14,0.72)',
                cursor: 'pointer', zIndex: 60,
                backdropFilter: 'blur(4px)',
              }}
            >
              {/* Title */}
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                style={{ textAlign: 'center', marginBottom: 30 }}
              >
                <div style={{
                  fontSize: 28, fontWeight: 900, fontFamily: 'monospace',
                  background: 'linear-gradient(90deg, #a855f7, #be185d)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  letterSpacing: '0.12em',
                }}>
                  TUX S&amp;D + KINETIC
                </div>
                <div style={{
                  color: 'rgba(167,139,250,0.6)', fontSize: 11,
                  fontFamily: 'monospace', letterSpacing: '0.25em',
                  marginTop: 6,
                }}>
                  CINEMATIC CHART ANIMATION
                </div>
              </motion.div>

              {/* Play button */}
              <motion.div
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  width: 68, height: 68, borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(190,24,93,0.4))',
                  border: '2px solid rgba(168,85,247,0.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 24px rgba(124,58,237,0.4), 0 0 48px rgba(124,58,237,0.15)',
                }}
              >
                <svg width="22" height="26" viewBox="0 0 22 26">
                  <polygon points="2,1 21,13 2,25" fill="#e9d5ff" />
                </svg>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                style={{
                  marginTop: 16, color: 'rgba(167,139,250,0.5)',
                  fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.2em',
                }}
              >
                {completed ? 'CLICK TO REPLAY' : 'CLICK TO PLAY'}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress bar */}
        {running && (
          <div style={{
            position: 'absolute', bottom: 18, left: 0, right: 0, height: 2, zIndex: 50,
          }}>
            <motion.div
              animate={{ width: `${(elapsed / TOTAL_DURATION) * 100}%` }}
              transition={{ duration: 0 }}
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, #7c3aed, #be185d)',
                boxShadow: '0 0 6px rgba(124,58,237,0.6)',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
