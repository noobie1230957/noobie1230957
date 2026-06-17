// Shared design tokens for the TUX S&D Kinetic ad.
export const COLORS = {
  bg: '#F5F5F5',
  bgDark: '#0A0A0A',
  ink: '#0A0A0A',
  inkSoft: '#6B7280',
  red: '#EF4444',
  // Brand accent (TUX S&D Kinetic) - supply/demand trading green.
  brand: '#10B981',
  brandDark: '#059669',
  zoneDemand: 'rgba(16, 185, 129, 0.16)',
  zoneSupply: 'rgba(239, 68, 68, 0.16)',
};

export const FONT_FAMILY_FALLBACK =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// 28s @ 30fps = 840 frames.
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const DURATION_IN_FRAMES = 28 * FPS;

// Scene boundaries in seconds -> frames.
export const SCENES = {
  charts: {from: 0, durationInSeconds: 2},
  messy: {from: 2 * FPS, durationInSeconds: 2},
  indicators: {from: 4 * FPS, durationInSeconds: 2},
  fakeSignals: {from: 6 * FPS, durationInSeconds: 2},
  identify: {from: 8 * FPS, durationInSeconds: 2},
  easy: {from: 10 * FPS, durationInSeconds: 2},
  money: {from: 12 * FPS, durationInSeconds: 2},
  brand: {from: 14 * FPS, durationInSeconds: 3},
  structure: {from: 17 * FPS, durationInSeconds: 4},
  setups: {from: 21 * FPS, durationInSeconds: 4},
  endCard: {from: 25 * FPS, durationInSeconds: 3},
} as const;
